"""Tests for the existing monthly genre forecast script."""

from datetime import date
from pathlib import Path
import runpy

import numpy as np
import pandas as pd
import psycopg
import pytest
from sklearn import linear_model


FORECAST_PATH = Path(__file__).with_name("forecast.py")
FEATURE_COLUMNS = [
    "loan_points",
    "search_points",
    "view_points",
    "interaction_points",
    "recommendation_points",
]
POINT_COLUMNS = [*FEATURE_COLUMNS, "total_points"]


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.executions = []

    def __enter__(self):
        return self

    def __exit__(self, _error_type, _error, _traceback):
        return False

    def execute(self, statement, parameters=None):
        self.executions.append((statement, parameters))

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows):
        self.cursor_instance = FakeCursor(rows)

    def __enter__(self):
        return self

    def __exit__(self, _error_type, _error, _traceback):
        return False

    def cursor(self):
        return self.cursor_instance


def make_genre_row(
    month,
    tag_id,
    tag_name,
    loan_points=0.0,
    search_points=0.0,
    view_points=0.0,
    interaction_points=0.0,
    recommendation_points=0.0,
):
    feature_points = [
        loan_points,
        search_points,
        view_points,
        interaction_points,
        recommendation_points,
    ]
    return {
        "month": month,
        "tag_id": tag_id,
        "tag_name": tag_name,
        "loan_points": loan_points,
        "search_points": search_points,
        "view_points": view_points,
        "interaction_points": interaction_points,
        "recommendation_points": recommendation_points,
        "total_points": sum(feature_points),
    }


def run_forecast_script(
    monkeypatch,
    rows,
    ridge_class=None,
    connection_log=None,
):
    connections = connection_log if connection_log is not None else []

    def fake_connect(*_arguments, **_keyword_arguments):
        connection_rows = rows if len(connections) == 0 else []
        connection = FakeConnection(connection_rows)
        connections.append(connection)
        return connection

    monkeypatch.setenv("DATABASE_URL", "postgresql://forecast-test")
    monkeypatch.setattr(psycopg, "connect", fake_connect)
    if ridge_class is not None:
        monkeypatch.setattr(linear_model, "Ridge", ridge_class)

    result = runpy.run_path(str(FORECAST_PATH), run_name="forecast_test")
    return result, connections


def test_missing_month_is_added_with_zero_points(monkeypatch):
    rows = [
        make_genre_row("2026-04-01", "python", "Python", loan_points=10),
        make_genre_row("2026-06-01", "python", "Python", search_points=30),
    ]

    result, _connections = run_forecast_script(monkeypatch, rows)
    python_data = result["data"][result["data"]["tag_id"] == "python"]
    may_data = python_data[python_data["month"] == pd.Timestamp("2026-05-01")]

    assert python_data["month"].tolist() == [
        pd.Timestamp("2026-04-01"),
        pd.Timestamp("2026-05-01"),
        pd.Timestamp("2026-06-01"),
    ]
    assert may_data[POINT_COLUMNS].iloc[0].tolist() == [0.0] * 6
    assert python_data.iloc[0]["loan_points"] == 10
    assert python_data.iloc[2]["search_points"] == 30


def test_next_points_uses_only_the_same_genre(monkeypatch):
    rows = [
        make_genre_row("2026-04-01", "python", "Python", loan_points=10),
        make_genre_row("2026-05-01", "python", "Python", loan_points=20),
        make_genre_row("2026-06-01", "python", "Python", loan_points=30),
        make_genre_row("2026-04-01", "java", "Java", loan_points=100),
        make_genre_row("2026-05-01", "java", "Java", loan_points=200),
        make_genre_row("2026-06-01", "java", "Java", loan_points=300),
    ]

    result, _connections = run_forecast_script(monkeypatch, rows)
    python_data = result["data"][result["data"]["tag_id"] == "python"]

    assert python_data["next_points"].iloc[0] == 20
    assert python_data["next_points"].iloc[1] == 30
    assert pd.isna(python_data["next_points"].iloc[2])
    assert python_data["next_points"].dropna().tolist() == [20, 30]


def test_training_data_uses_five_features_and_excludes_last_month(monkeypatch):
    rows = [
        make_genre_row("2026-04-01", "python", "Python", loan_points=10),
        make_genre_row("2026-05-01", "python", "Python", loan_points=20),
        make_genre_row("2026-06-01", "python", "Python", loan_points=30),
        make_genre_row("2026-04-01", "java", "Java", loan_points=100),
        make_genre_row("2026-05-01", "java", "Java", loan_points=200),
        make_genre_row("2026-06-01", "java", "Java", loan_points=300),
    ]

    result, _connections = run_forecast_script(monkeypatch, rows)
    training_data = result["training_data"]
    X = result["X"]
    y = result["y"]

    assert pd.Timestamp("2026-06-01") not in training_data["month"].tolist()
    assert X.columns.tolist() == FEATURE_COLUMNS
    assert y.name == "next_points"
    assert not training_data["next_points"].isna().any()
    assert not X.isna().any().any()


def test_ridge_returns_one_finite_prediction_per_latest_genre(monkeypatch):
    rows = [
        make_genre_row("2026-04-01", "a-small", "小さい入力", 1, 1, 1, 1, 1),
        make_genre_row("2026-05-01", "a-small", "小さい入力", 2, 2, 2, 2, 2),
        make_genre_row("2026-06-01", "a-small", "小さい入力", 3, 3, 3, 3, 3),
        make_genre_row("2026-04-01", "b-large", "大きい入力", 2, 2, 2, 2, 2),
        make_genre_row("2026-05-01", "b-large", "大きい入力", 4, 4, 4, 4, 4),
        make_genre_row("2026-06-01", "b-large", "大きい入力", 6, 6, 6, 6, 6),
    ]

    result, _connections = run_forecast_script(monkeypatch, rows)
    predictions = result["next_month_predictions"]

    assert len(predictions) == 2
    assert np.issubdtype(predictions.dtype, np.number)
    assert np.isfinite(predictions).all()
    assert predictions[1] > predictions[0]


def test_negative_predictions_are_clipped_to_zero(monkeypatch):
    class NegativeRidge:
        def __init__(self, alpha):
            assert alpha == 1.0

        def fit(self, _X, _y):
            return self

        def predict(self, _X):
            return np.array([-5.0, 2.0])

    rows = [
        make_genre_row("2026-05-01", "python", "Python", loan_points=10),
        make_genre_row("2026-06-01", "python", "Python", loan_points=20),
        make_genre_row("2026-05-01", "java", "Java", loan_points=30),
        make_genre_row("2026-06-01", "java", "Java", loan_points=40),
    ]

    result, _connections = run_forecast_script(
        monkeypatch, rows, ridge_class=NegativeRidge
    )

    assert result["next_month_predictions"].tolist() == [0.0, 2.0]


@pytest.mark.parametrize(
    ("latest_month", "expected_prediction_month"),
    [
        ("2026-06-01", date(2026, 7, 1)),
        ("2026-12-01", date(2027, 1, 1)),
    ],
)
def test_prediction_month_is_the_first_day_of_next_month(
    monkeypatch,
    latest_month,
    expected_prediction_month,
):
    previous_month = (
        pd.Timestamp(latest_month) - pd.DateOffset(months=1)
    ).strftime("%Y-%m-%d")
    rows = [
        make_genre_row(previous_month, "python", "Python", loan_points=10),
        make_genre_row(latest_month, "python", "Python", loan_points=20),
    ]

    result, _connections = run_forecast_script(monkeypatch, rows)

    assert result["prediction_month"] == expected_prediction_month


def test_save_arrays_have_matching_lengths_and_database_types(monkeypatch):
    rows = [
        make_genre_row("2026-05-01", "python", "Python", loan_points=10),
        make_genre_row("2026-06-01", "python", "Python", loan_points=20),
        make_genre_row("2026-05-01", "java", "Java", loan_points=30),
        make_genre_row("2026-06-01", "java", "Java", loan_points=40),
    ]

    result, connections = run_forecast_script(monkeypatch, rows)
    prediction_months = result["prediction_months"]
    tag_ids = result["tag_ids"]
    predicted_points = result["predicted_points"]
    saved_parameters = connections[1].cursor_instance.executions[-1][1]

    assert len(prediction_months) == len(tag_ids) == len(predicted_points) == 2
    assert all(isinstance(month, date) for month in prediction_months)
    assert set(tag_ids) == {"python", "java"}
    assert all(isinstance(points, float) for points in predicted_points)
    assert saved_parameters == (prediction_months, tag_ids, predicted_points)


def test_empty_database_data_skips_training_and_saving(monkeypatch):
    class RidgeMustNotRun:
        def __init__(self, _alpha):
            pytest.fail("空データでRidgeが作成されました")

    result, connections = run_forecast_script(
        monkeypatch,
        [],
        ridge_class=RidgeMustNotRun,
    )

    assert result["data"].empty
    assert "clf" not in result
    assert len(connections) == 1


def test_one_month_data_has_no_training_rows_and_stops_before_saving(monkeypatch):
    real_ridge = linear_model.Ridge
    captured_training_data = {}
    connections = []

    class InspectingRidge(real_ridge):
        def fit(self, X, y):
            captured_training_data["X"] = X.copy()
            captured_training_data["y"] = y.copy()
            return super().fit(X, y)

    rows = [
        make_genre_row("2026-06-01", "python", "Python", loan_points=10),
        make_genre_row("2026-06-01", "java", "Java", loan_points=20),
    ]

    with pytest.raises(ValueError, match="0 sample"):
        run_forecast_script(
            monkeypatch,
            rows,
            ridge_class=InspectingRidge,
            connection_log=connections,
        )

    assert captured_training_data["X"].empty
    assert captured_training_data["y"].empty
    assert len(connections) == 1
