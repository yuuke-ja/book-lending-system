"""Run a Ridge forecast with manually entered monthly genre data."""

import pandas as pd
from sklearn.linear_model import Ridge


feature_columns = [
    "loan_points",
    "search_points",
    "view_points",
    "interaction_points",
    "recommendation_points",
]

# この値を書き換えると、DBへ接続せずに予測を試せる。
manual_rows = [
    ["2026-03-01", "ai", "AI", 0, 4, 8, 3, 1],
    ["2026-04-01", "ai", "AI", 0, 6, 11, 4, 1],
    ["2026-05-01", "ai", "AI", 10, 5, 10, 3, 1],
    ["2026-06-01", "ai", "AI", 10, 7, 12, 4, 1],
    ["2026-07-01", "ai", "AI", 10, 8, 15, 5, 2],
    ["2026-03-01", "web", "Web開発", 10, 4, 8, 2, 1],
    ["2026-04-01", "web", "Web開発", 10, 5, 10, 3, 1],
    ["2026-05-01", "web", "Web開発", 20, 4, 8, 3, 1],
    ["2026-06-01", "web", "Web開発", 20, 6, 11, 4, 1],
    ["2026-07-01", "web", "Web開発", 20, 8, 14, 5, 2],
]

data = pd.DataFrame(
    manual_rows,
    columns=["month", "tag_id", "tag_name", *feature_columns],
)
data["month"] = pd.to_datetime(data["month"])
data["total_points"] = data[feature_columns].sum(axis=1)
data = data.sort_values(["tag_id", "month"]).reset_index(drop=True)
data["next_points"] = data.groupby("tag_id")["total_points"].shift(-1)

# 最終月の実績を学習から隠し、その1か月前から最終月を予測する。
prediction_month = data["month"].max()
input_month = prediction_month - pd.DateOffset(months=1)
training_data = data[
    data["next_points"].notna() & (data["month"] < input_month)
]

X = training_data[feature_columns]
y = training_data["next_points"]

clf = Ridge(alpha=1.0)
clf.fit(X, y)

prediction_data = data[data["month"] == input_month].copy()
prediction_data["predicted_points"] = clf.predict(
    prediction_data[feature_columns]
).clip(0, None)

actual_data = data[data["month"] == prediction_month][
    ["tag_id", "total_points"]
].rename(columns={"total_points": "actual_points"})

result = prediction_data.merge(actual_data, on="tag_id", how="left")
result["prediction_month"] = prediction_month
result["absolute_error"] = (
    result["actual_points"] - result["predicted_points"]
).abs()

print(
    result[
        [
            "prediction_month",
            "tag_name",
            "predicted_points",
            "actual_points",
            "absolute_error",
        ]
    ].to_string(index=False)
)
