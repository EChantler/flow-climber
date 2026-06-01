#!/usr/bin/env python3
"""Train FlowClimb challenge-label models using only deaths and height-delta features."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import mlflow
import numpy as np
import pandas as pd
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC


DEATHS_HEIGHT_FEATURE_COLUMNS = ["deaths_delta", "height_delta"]


MODEL_TARGETS = {
    "logistic_regression": LogisticRegression(
        C=0.5,
        l1_ratio=0.0,
        solver="lbfgs",
        max_iter=1000,
        class_weight="balanced",
        random_state=42,
    ),
    "rbf_svc": SVC(kernel="rbf", C=1.0, gamma="scale", class_weight="balanced", probability=True, random_state=42),
    "gaussian_nb": GaussianNB(var_smoothing=1e-8),
}


@dataclass(frozen=True)
class TrainingConfig:
    data_path: Path
    train_data_path: Path | None
    validation_data_path: Path | None
    target_column: str
    output_dir: Path
    feature_columns: list[str] | None
    experiment_name: str
    tracking_uri: str
    test_size: float
    random_state: int


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("ml/data/flowclimb_export.csv"), help="Single CSV to split when explicit train/validation CSVs are not provided.")
    parser.add_argument("--train-data", type=Path, default=None, help="Pre-split training CSV.")
    parser.add_argument("--validation-data", type=Path, default=None, help="Pre-split validation CSV.")
    parser.add_argument("--target", default="challenge_label")
    parser.add_argument("--output-dir", type=Path, default=Path("ml/models/deaths_height"))
    parser.add_argument("--features", nargs="*", default=None, help="Explicit feature columns in ONNX inference order.")
    parser.add_argument("--experiment-name", default="flowclimb-challenge-models")
    parser.add_argument("--tracking-uri", default="file:ml/mlruns")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()
    return TrainingConfig(
        data_path=args.data,
        train_data_path=args.train_data,
        validation_data_path=args.validation_data,
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
        raise ValueError("This diagnostic script always uses only deaths_delta and height_delta; do not pass --features.")
    missing = [column for column in DEATHS_HEIGHT_FEATURE_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"Deaths/height feature columns missing from CSV: {missing}")
    return list(DEATHS_HEIGHT_FEATURE_COLUMNS)


def build_pipeline(model_name: str) -> Pipeline:
    model = MODEL_TARGETS[model_name]
    if model_name in {"logistic_regression", "rbf_svc"}:
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
    if model_name in {"logistic_regression", "gaussian_nb", "rbf_svc"}:
        options[id(final_estimator)] = {"zipmap": False}
    onnx_model = convert_sklearn(pipeline, initial_types=initial_types, target_opset=15, options=options)
    output_path.write_bytes(onnx_model.SerializeToString())


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def save_confusion_matrix_plot(path: Path, matrix: np.ndarray, class_names: list[str], title: str) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))
    image = ax.imshow(matrix, interpolation="nearest", cmap="Blues")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    ax.set(
        title=title,
        xlabel="Predicted label",
        ylabel="True label",
        xticks=np.arange(len(class_names)),
        yticks=np.arange(len(class_names)),
        xticklabels=class_names,
        yticklabels=class_names,
    )
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")
    threshold = matrix.max() / 2 if matrix.size else 0
    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            ax.text(
                col,
                row,
                int(matrix[row, col]),
                ha="center",
                va="center",
                color="white" if matrix[row, col] > threshold else "black",
            )
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def save_metric_bar_plot(path: Path, metrics: dict[str, float], title: str) -> None:
    metric_names = ["validation_accuracy", "validation_balanced_accuracy", "validation_f1_macro", "validation_f1_weighted", "train_accuracy"]
    labels = ["Val accuracy", "Val balanced acc", "Val F1 macro", "Val F1 weighted", "Train accuracy"]
    values = [metrics[name] for name in metric_names if name in metrics]
    labels = [label for name, label in zip(metric_names, labels, strict=True) if name in metrics]

    fig, ax = plt.subplots(figsize=(8, 4.5))
    bars = ax.bar(labels, values, color=["#4e79a7", "#59a14f", "#f28e2b", "#e15759", "#76b7b2"][: len(values)])
    ax.set_ylim(0, 1)
    ax.set_ylabel("Score")
    ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=25, ha="right")
    for bar, value in zip(bars, values, strict=True):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.015, f"{value:.3f}", ha="center", va="bottom")
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def save_per_class_f1_plot(path: Path, metrics: dict[str, float], class_names: list[str], title: str) -> None:
    safe_names = [class_name.replace(" ", "_").replace("-", "_") for class_name in class_names]
    values = [metrics.get(f"validation_f1_{safe_name}", 0) for safe_name in safe_names]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bars = ax.bar(class_names, values, color="#9c755f")
    ax.set_ylim(0, 1)
    ax.set_ylabel("Validation F1")
    ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=25, ha="right")
    for bar, value in zip(bars, values, strict=True):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.015, f"{value:.3f}", ha="center", va="bottom")
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def save_model_comparison_plot(path: Path, model_metrics: dict[str, dict[str, float]]) -> None:
    metric_names = ["validation_accuracy", "validation_balanced_accuracy", "validation_f1_macro"]
    labels = ["Val accuracy", "Val balanced acc", "Val F1 macro"]
    model_names = list(model_metrics)
    x = np.arange(len(model_names))
    width = 0.24
    fig, ax = plt.subplots(figsize=(9, 5))
    for index, (metric_name, label) in enumerate(zip(metric_names, labels, strict=True)):
        values = [model_metrics[model_name].get(metric_name, 0) for model_name in model_names]
        offset = (index - 1) * width
        bars = ax.bar(x + offset, values, width, label=label)
        for bar, value in zip(bars, values, strict=True):
            ax.text(bar.get_x() + bar.get_width() / 2, value + 0.01, f"{value:.2f}", ha="center", va="bottom", fontsize=8)
    ax.set_ylim(0, 1)
    ax.set_ylabel("Score")
    ax.set_title("Validation metric comparison")
    ax.set_xticks(x, model_names, rotation=20, ha="right")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    labels: np.ndarray,
    class_names: list[str],
    prefix: str = "",
) -> dict[str, float]:
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "precision_macro": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "precision_weighted": precision_score(y_true, y_pred, average="weighted", zero_division=0),
        "recall_weighted": recall_score(y_true, y_pred, average="weighted", zero_division=0),
        "f1_weighted": f1_score(y_true, y_pred, average="weighted", zero_division=0),
    }
    per_class_precision = precision_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_recall = recall_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    per_class_support = np.bincount(y_true, minlength=len(labels))
    for index, class_name in enumerate(class_names):
        safe_class_name = class_name.replace(" ", "_").replace("-", "_")
        metrics[f"precision_{safe_class_name}"] = per_class_precision[index]
        metrics[f"recall_{safe_class_name}"] = per_class_recall[index]
        metrics[f"f1_{safe_class_name}"] = per_class_f1[index]
        metrics[f"support_{safe_class_name}"] = int(per_class_support[index])
    return {f"{prefix}{key}": value for key, value in metrics.items()}


def load_training_frames(config: TrainingConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if config.train_data_path or config.validation_data_path:
        if not config.train_data_path or not config.validation_data_path:
            raise ValueError("Pass both --train-data and --validation-data, or neither.")
        train_frame = pd.read_csv(config.train_data_path)
        validation_frame = pd.read_csv(config.validation_data_path)
        full_frame = pd.concat([train_frame, validation_frame])
        return train_frame, validation_frame, full_frame

    frame = pd.read_csv(config.data_path)
    y_raw = frame[config.target_column].astype(str)
    _, class_counts = np.unique(y_raw, return_counts=True)
    can_stratify = len(class_counts) > 1 and np.all(class_counts >= 2)
    train_frame, validation_frame = train_test_split(
        frame,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=y_raw if can_stratify else None,
    )
    return train_frame, validation_frame, frame


def validate_feature_columns(frames: Iterable[pd.DataFrame], feature_columns: list[str], target_column: str) -> None:
    required_columns = feature_columns + [target_column]
    for frame in frames:
        missing = [column for column in required_columns if column not in frame.columns]
        if missing:
            raise ValueError(f"Required columns missing from training split: {missing}")


def main() -> None:
    config = parse_args()
    train_frame, validation_frame, full_frame = load_training_frames(config)
    feature_columns = resolve_feature_columns(train_frame, config.target_column, config.feature_columns)
    validate_feature_columns(
        [validation_frame],
        feature_columns,
        config.target_column,
    )

    label_encoder = LabelEncoder()
    label_encoder.fit(full_frame[config.target_column].astype(str))
    class_names = label_encoder.classes_.tolist()
    class_labels = np.arange(len(class_names))
    class_values, class_counts = np.unique(label_encoder.transform(full_frame[config.target_column].astype(str)), return_counts=True)
    class_distribution = {
        class_names[class_value]: int(count)
        for class_value, count in zip(class_values, class_counts, strict=True)
    }

    x_train = train_frame[feature_columns].astype(np.float32)
    y_train = label_encoder.transform(train_frame[config.target_column].astype(str))
    x_test = validation_frame[feature_columns].astype(np.float32)
    y_test = label_encoder.transform(validation_frame[config.target_column].astype(str))

    config.output_dir.mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri(config.tracking_uri)
    mlflow.set_experiment(config.experiment_name)

    manifest_models = []
    model_metrics = {}
    for model_name in MODEL_TARGETS:
        pipeline = build_pipeline(model_name)
        with mlflow.start_run(run_name=model_name):
            pipeline.fit(x_train.to_numpy(dtype=np.float32), y_train)
            train_predictions = pipeline.predict(x_train.to_numpy(dtype=np.float32))
            predictions = pipeline.predict(x_test.to_numpy(dtype=np.float32))
            metrics = compute_metrics(y_test, predictions, class_labels, class_names, prefix="validation_")
            metrics["train_accuracy"] = accuracy_score(y_train, train_predictions)

            mlflow.log_param("model_name", model_name)
            mlflow.log_param("data_path", str(config.data_path))
            mlflow.log_param("train_data_path", str(config.train_data_path) if config.train_data_path else "")
            mlflow.log_param("validation_data_path", str(config.validation_data_path) if config.validation_data_path else "")
            mlflow.log_param("target_column", config.target_column)
            mlflow.log_param("feature_columns", json.dumps(feature_columns))
            mlflow.log_param("feature_count", len(feature_columns))
            mlflow.log_param("row_count", len(full_frame))
            mlflow.log_param("train_row_count", len(x_train))
            mlflow.log_param("validation_row_count", len(x_test))
            mlflow.log_param("test_size", config.test_size)
            mlflow.log_param("random_state", config.random_state)
            mlflow.log_param("classes", json.dumps(class_names))
            mlflow.log_param("class_distribution", json.dumps(class_distribution, sort_keys=True))
            for metric_name, metric_value in metrics.items():
                mlflow.log_metric(metric_name, metric_value)

            report = classification_report(
                y_test,
                predictions,
                target_names=class_names,
                output_dict=True,
                zero_division=0,
            )
            report_path = config.output_dir / f"{model_name}.validation_classification_report.json"
            write_json(report_path, report)
            mlflow.log_artifact(str(report_path))

            confusion = confusion_matrix(y_test, predictions, labels=class_labels)
            confusion_payload = {
                "labels": class_names,
                "matrix": confusion.astype(int).tolist(),
            }
            confusion_path = config.output_dir / f"{model_name}.validation_confusion_matrix.json"
            write_json(confusion_path, confusion_payload)
            mlflow.log_artifact(str(confusion_path))

            confusion_plot_path = config.output_dir / f"{model_name}.validation_confusion_matrix.png"
            save_confusion_matrix_plot(confusion_plot_path, confusion, class_names, f"{model_name} validation confusion matrix")
            mlflow.log_artifact(str(confusion_plot_path))

            metrics_plot_path = config.output_dir / f"{model_name}.validation_metrics.png"
            save_metric_bar_plot(metrics_plot_path, metrics, f"{model_name} validation metrics")
            mlflow.log_artifact(str(metrics_plot_path))

            per_class_f1_plot_path = config.output_dir / f"{model_name}.validation_per_class_f1.png"
            save_per_class_f1_plot(per_class_f1_plot_path, metrics, class_names, f"{model_name} validation F1 by class")
            mlflow.log_artifact(str(per_class_f1_plot_path))

            onnx_path = config.output_dir / f"{model_name}.onnx"
            export_onnx(pipeline, onnx_path, len(feature_columns), model_name)
            mlflow.log_artifact(str(onnx_path))

            metadata = {
                "model_name": model_name,
                "onnx_file": onnx_path.name,
                "target_column": config.target_column,
                "feature_columns": feature_columns,
                "classes": class_names,
                "class_distribution": class_distribution,
                "metrics": metrics,
            }
            metadata_path = config.output_dir / f"{model_name}.metadata.json"
            write_json(metadata_path, metadata)
            mlflow.log_artifact(str(metadata_path))
            manifest_models.append(metadata)
            model_metrics[model_name] = metrics

    comparison_plot_path = config.output_dir / "model_validation_metric_comparison.png"
    save_model_comparison_plot(comparison_plot_path, model_metrics)

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
