#!/usr/bin/env python3
"""Train FlowClimb challenge-label model candidates and export ONNX files."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import mlflow
import numpy as np
import pandas as pd
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC


MODEL_TARGETS = {
    "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
    "linear_svc": LinearSVC(class_weight="balanced", random_state=42),
    "gaussian_nb": GaussianNB(),
}


@dataclass(frozen=True)
class TrainingConfig:
    data_path: Path
    target_column: str
    output_dir: Path
    feature_columns: list[str] | None
    experiment_name: str
    tracking_uri: str
    test_size: float
    random_state: int


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("ml/data/flowclimb_export.csv"))
    parser.add_argument("--target", default="challenge_label")
    parser.add_argument("--output-dir", type=Path, default=Path("ml/models"))
    parser.add_argument("--features", nargs="*", default=None, help="Explicit feature columns in ONNX inference order.")
    parser.add_argument("--experiment-name", default="flowclimb-challenge-models")
    parser.add_argument("--tracking-uri", default="file:ml/mlruns")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()
    return TrainingConfig(
        data_path=args.data,
        target_column=args.target,
        output_dir=args.output_dir,
        feature_columns=args.features,
        experiment_name=args.experiment_name,
        tracking_uri=args.tracking_uri,
        test_size=args.test_size,
        random_state=args.random_state,
    )


def resolve_feature_columns(frame: pd.DataFrame, target_column: str, requested: Iterable[str] | None) -> list[str]:
    if target_column not in frame.columns:
        raise ValueError(f"Target column '{target_column}' is missing from CSV")

    if requested:
        missing = [column for column in requested if column not in frame.columns]
        if missing:
            raise ValueError(f"Requested feature columns missing from CSV: {missing}")
        return list(requested)

    numeric_columns = frame.select_dtypes(include=[np.number]).columns.tolist()
    features = [column for column in numeric_columns if column != target_column]
    if not features:
        raise ValueError("No numeric feature columns found. Pass --features to select columns explicitly.")
    return features


def build_pipeline(model_name: str) -> Pipeline:
    model = MODEL_TARGETS[model_name]
    if model_name in {"logistic_regression", "linear_svc"}:
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", model),
        ])
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", model),
    ])


def export_onnx(pipeline: Pipeline, output_path: Path, feature_count: int, model_name: str) -> None:
    initial_types = [("float_input", FloatTensorType([None, feature_count]))]
    final_estimator = pipeline.steps[-1][1]
    options = {}
    if model_name in {"logistic_regression", "gaussian_nb"}:
        options[id(final_estimator)] = {"zipmap": False}
    elif model_name == "linear_svc":
        options[id(final_estimator)] = {"nocl": True}
    onnx_model = convert_sklearn(pipeline, initial_types=initial_types, target_opset=15, options=options)
    output_path.write_bytes(onnx_model.SerializeToString())


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    config = parse_args()
    frame = pd.read_csv(config.data_path)
    feature_columns = resolve_feature_columns(frame, config.target_column, config.feature_columns)

    x = frame[feature_columns].astype(np.float32)
    y_raw = frame[config.target_column].astype(str)
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)

    _, class_counts = np.unique(y, return_counts=True)
    can_stratify = len(class_counts) > 1 and np.all(class_counts >= 2)
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=y if can_stratify else None,
    )

    config.output_dir.mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri(config.tracking_uri)
    mlflow.set_experiment(config.experiment_name)

    manifest_models = []
    for model_name in MODEL_TARGETS:
        pipeline = build_pipeline(model_name)
        with mlflow.start_run(run_name=model_name):
            pipeline.fit(x_train.to_numpy(dtype=np.float32), y_train)
            predictions = pipeline.predict(x_test.to_numpy(dtype=np.float32))
            accuracy = accuracy_score(y_test, predictions)

            mlflow.log_param("model_name", model_name)
            mlflow.log_param("target_column", config.target_column)
            mlflow.log_param("feature_columns", json.dumps(feature_columns))
            mlflow.log_metric("accuracy", accuracy)

            report = classification_report(
                y_test,
                predictions,
                target_names=label_encoder.classes_,
                output_dict=True,
                zero_division=0,
            )
            report_path = config.output_dir / f"{model_name}.classification_report.json"
            write_json(report_path, report)
            mlflow.log_artifact(str(report_path))

            onnx_path = config.output_dir / f"{model_name}.onnx"
            export_onnx(pipeline, onnx_path, len(feature_columns), model_name)
            mlflow.log_artifact(str(onnx_path))

            metadata = {
                "model_name": model_name,
                "onnx_file": onnx_path.name,
                "target_column": config.target_column,
                "feature_columns": feature_columns,
                "classes": label_encoder.classes_.tolist(),
                "metrics": {"accuracy": accuracy},
            }
            metadata_path = config.output_dir / f"{model_name}.metadata.json"
            write_json(metadata_path, metadata)
            mlflow.log_artifact(str(metadata_path))
            manifest_models.append(metadata)

    write_json(
        config.output_dir / "manifest.json",
        {
            "target_column": config.target_column,
            "feature_columns": feature_columns,
            "models": manifest_models,
        },
    )


if __name__ == "__main__":
    main()
