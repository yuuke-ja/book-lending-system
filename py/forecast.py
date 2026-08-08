"""Fetch monthly genre point data from PostgreSQL."""

import os

import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import (r2_score, root_mean_squared_error, mean_absolute_error)
import psycopg
from psycopg.rows import dict_row


dburl = os.environ["DATABASE_URL"]

sql = """
WITH point_events AS (
  SELECT
    se."occurredAt" AS occurred_at,
    event_tag."tagId" AS tag_id,
    'search' AS feature,
    CASE se."searchType"
      WHEN 'book_list' THEN event_tag.confidence * %s::float
      WHEN 'ai_query' THEN event_tag.confidence * %s::float
      ELSE 0
    END AS points
  FROM "SearchEvent" se
  JOIN "SearchEventTag" event_tag
    ON event_tag."searchEventId" = se.id

  UNION ALL

  SELECT
    loan."loanedAt",
    book_tag."tagId",
    'loan',
    %s::float
  FROM "Loan" loan
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = loan."bookId"

  UNION ALL

  SELECT
    event."occurredAt",
    book_tag."tagId",
    'view',
    %s::float
  FROM "ResearchEvent" event
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = event."bookId"
  WHERE event."eventType" = 'book_detail_view'

  UNION ALL

  SELECT
    event."occurredAt",
    book_tag."tagId",
    'view',
    %s::float
  FROM "ResearchEvent" event
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = event."bookId"
  WHERE event."eventType" = 'post_view'

  UNION ALL

  SELECT
    event."occurredAt",
    book_tag."tagId",
    'interaction',
    %s::float
  FROM "ResearchEvent" event
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = event."bookId"
  WHERE event."eventType" = 'book_link_click'
    AND event."sourceType" = 'thread'

  UNION ALL

  SELECT
    event."occurredAt",
    book_tag."tagId",
    'interaction',
    %s::float
  FROM "ResearchEvent" event
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = event."bookId"
  WHERE event."eventType" = 'book_link_click'
    AND event."sourceType" = 'comment'

  UNION ALL

  SELECT
    event."occurredAt",
    book_tag."tagId",
    'interaction',
    %s::float
  FROM "ResearchEvent" event
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = event."bookId"
  WHERE event."eventType" = 'book_link_click'
    AND event."sourceType" = 'ai_chat'

  UNION ALL

  SELECT
    recommendation."createdAt",
    book_tag."tagId",
    'recommendation',
    %s::float
  FROM "AiRecommendation" recommendation
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = recommendation."bookId"

  UNION ALL

  SELECT
    thread."createdAt",
    book_tag."tagId",
    'interaction',
    %s::float
  FROM "Thread" thread
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = thread."bookId"
  WHERE thread."bookId" IS NOT NULL

  UNION ALL

  SELECT
    comment."createdAt",
    book_tag."tagId",
    'interaction',
    %s::float
  FROM "ThreadComment" comment
  JOIN "CommentBookLink" comment_book_link
    ON comment_book_link."commentId" = comment.id
  JOIN "BookTag" book_tag
    ON book_tag."bookId" = comment_book_link."bookId"
)
SELECT
  date_trunc('month', point_event.occurred_at)::date AS month,
  tag.id AS tag_id,
  tag.tag AS tag_name,
  COALESCE(
    SUM(point_event.points) FILTER (WHERE point_event.feature = 'loan'),
    0
  )::double precision AS loan_points,
  COALESCE(
    SUM(point_event.points) FILTER (WHERE point_event.feature = 'search'),
    0
  )::double precision AS search_points,
  COALESCE(
    SUM(point_event.points) FILTER (WHERE point_event.feature = 'view'),
    0
  )::double precision AS view_points,
  COALESCE(
    SUM(point_event.points) FILTER (WHERE point_event.feature = 'interaction'),
    0
  )::double precision AS interaction_points,
  COALESCE(
    SUM(point_event.points) FILTER (WHERE point_event.feature = 'recommendation'),
    0
  )::double precision AS recommendation_points,
  SUM(point_event.points)::double precision AS total_points
FROM point_events point_event
JOIN "TagList" tag
  ON tag.id = point_event.tag_id
WHERE point_event.occurred_at
  < date_trunc(
      'month',
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
    )
GROUP BY
  date_trunc('month', point_event.occurred_at),
  tag.id,
  tag.tag
ORDER BY month, total_points DESC
"""

weights = (
    1.0,  # book_list search
    1.0,  # ai_query search
    10.0,  # loan
    0.5,  # book_detail_view
    0.5,  # post_view
    2.0,  # thread book_link_click
    2.0,  # comment book_link_click
    2.0,  # ai_chat book_link_click
    0.5,  # AI recommendation
    3.0,  # thread creation
    1.0,  # comment creation
)

with psycopg.connect(dburl, row_factory=dict_row) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SET TRANSACTION READ ONLY")
        cursor.execute(sql, weights)
        rows = cursor.fetchall()

data = pd.DataFrame(rows)

point_columns = [
    "loan_points",
    "search_points",
    "view_points",
    "interaction_points",
    "recommendation_points",
    "total_points",
]

if not data.empty:
    data["month"] = pd.to_datetime(data["month"])

    months = pd.DataFrame(
        {
            "month": pd.date_range(
                start=data["month"].min(),
                end=data["month"].max(),
                freq="MS",
            )
        }
    )
    genres = data[["tag_id", "tag_name"]].drop_duplicates()

    monthly_genres = months.merge(genres, how="cross")
    data = monthly_genres.merge(
        data,
        on=["month", "tag_id", "tag_name"],
        how="left",
    )
    
    data[point_columns] = data[point_columns].fillna(0.0)
    data = data.sort_values(["tag_id", "month"]).reset_index(drop=True)
    data["next_points"] = data.groupby("tag_id")["total_points"].shift(-1)

    feature_columns = [
        "loan_points",
        "search_points",
        "view_points",
        "interaction_points",
        "recommendation_points",
    ]

    training_data = data.dropna(subset=["next_points"])
    X = training_data[feature_columns]
    y = training_data["next_points"]

    clf = Ridge(alpha=1.0)
    clf.fit(X, y)

    r2 = r2_score(y, clf.predict(X))
    rmse = root_mean_squared_error(y, clf.predict(X))
    mae = mean_absolute_error(y, clf.predict(X))
    print(f"R^2 スコア: {r2:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"MAE: {mae:.4f}")

    month_columns = data["month"]
    last_month = month_columns.max()
    last_month_data = data[data["month"] == last_month].copy()
    X_last_month = last_month_data[feature_columns]
    next_month_predictions = clf.predict(X_last_month).clip(0, None)
    prediction_month = (last_month + pd.DateOffset(months=1)).date()
    last_month_data["prediction_month"] = prediction_month
    last_month_data["predicted_points"] = next_month_predictions
    prediction_months = last_month_data["prediction_month"].tolist()
    tag_ids = last_month_data["tag_id"].tolist()
    predicted_points = last_month_data["predicted_points"].astype(float).tolist()

    save_sql = """
    INSERT INTO "GenrePointPrediction" (
      "predictionMonth",
      "tagId",
      "predictedPoints",
      "modelName"
    )
    SELECT
      prediction."predictionMonth",
      prediction."tagId",
      prediction."predictedPoints",
      'ridge'
    FROM unnest(
      %s::date[],
      %s::text[],
      %s::double precision[]
    ) AS prediction(
      "predictionMonth",
      "tagId",
      "predictedPoints"
    )
    ON CONFLICT ("predictionMonth", "tagId")
    DO UPDATE SET
      "predictedPoints" = EXCLUDED."predictedPoints",
      "modelName" = EXCLUDED."modelName",
      "updatedAt" = CURRENT_TIMESTAMP
    """

    with psycopg.connect(dburl) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                save_sql,
                (prediction_months, tag_ids, predicted_points),
            )

    print(
        last_month_data[
            ["prediction_month", "tag_name", "predicted_points"]
        ].to_string(index=False)
    )

print(data)
