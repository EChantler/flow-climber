#!/usr/bin/env python3
"""Preprocess raw FlowClimb telemetry CSVs for ML training."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_INPUT = Path("ml/data/raw/2026-05-30-21-02.csv")
DEFAULT_OUTPUT_DIR = Path("ml/data/processed")
DEFAULT_METADATA_COLUMN = "metadata"
DEFAULT_DROPPED_METADATA_KEYS = ("failed_jump_counts",)
DEFAULT_GAME_MODE = "train"
DEFAULT_SPLIT_COLUMN = "challenge_label"
DEFAULT_TRAIN_SHARE = 0.7
DEFAULT_VALIDATION_SHARE = 0.15
DEFAULT_TEST_SHARE = 0.15
DEFAULT_RANDOM_STATE = 42
DEFAULT_DROPPED_COLUMNS = (
    "id",
    "session_id",
    "token_used",
    "metric_value",
    "event_type",
    "created_at",
    "game_version",
    "game_mode",
    "window_started_at",
    "window_ended_at",
    "data_schema_version",
    "deployment_context",
    "meta_logged_at",
    "meta_window_duration_ms",
    "meta_platform_height_avg_px",
    "meta_platform_height_max_px",
    "meta_platform_height_min_px",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Raw telemetry CSV to preprocess.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Processed CSV path. Defaults to ml/data/processed/<input-stem>.processed.csv.",
    )
    parser.add_argument("--metadata-column", default=DEFAULT_METADATA_COLUMN)
    parser.add_argument(
        "--drop-metadata-key",
        action="append",
        default=list(DEFAULT_DROPPED_METADATA_KEYS),
        help="Top-level metadata dictionary key to omit before flattening. Can be passed multiple times.",
    )
    parser.add_argument(
        "--min-data-schema-version",
        type=float,
        default=6,
        help="Minimum data_schema_version to include before null filtering.",
    )
    parser.add_argument(
        "--game-mode",
        default=DEFAULT_GAME_MODE,
        help="Game mode to include. Use an empty string to skip game_mode filtering.",
    )
    parser.add_argument(
        "--drop-column",
        action="append",
        default=list(DEFAULT_DROPPED_COLUMNS),
        help="Output column to drop after metadata flattening. Can be passed multiple times.",
    )
    parser.add_argument("--split-column", default=DEFAULT_SPLIT_COLUMN)
    parser.add_argument("--train-share", type=float, default=DEFAULT_TRAIN_SHARE)
    parser.add_argument("--validation-share", type=float, default=DEFAULT_VALIDATION_SHARE)
    parser.add_argument("--test-share", type=float, default=DEFAULT_TEST_SHARE)
    parser.add_argument("--random-state", type=int, default=DEFAULT_RANDOM_STATE)
    return parser.parse_args()


def parse_metadata(value: Any, dropped_keys: set[str]) -> dict[str, Any]:
    if pd.isna(value):
        return {}
    if isinstance(value, dict):
        parsed = value
    else:
        try:
            parsed = json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return {}
    if not isinstance(parsed, dict):
        return {}
    return {key: val for key, val in parsed.items() if key not in dropped_keys}


def default_output_path(input_path: Path) -> Path:
    return DEFAULT_OUTPUT_DIR / f"{input_path.stem}.processed.csv"


def split_output_path(output_path: Path, split_name: str) -> Path:
    return output_path.with_name(f"{output_path.stem}.{split_name}{output_path.suffix}")


def validate_split_shares(train_share: float, validation_share: float, test_share: float) -> None:
    total = train_share + validation_share + test_share
    if not np_isclose(total, 1.0):
        raise ValueError(f"Split shares must sum to 1.0; got {total:.6f}")
    if min(train_share, validation_share, test_share) <= 0:
        raise ValueError("Split shares must all be positive")


def np_isclose(left: float, right: float, tolerance: float = 1e-9) -> bool:
    return abs(left - right) <= tolerance


def split_frame(
    frame: pd.DataFrame,
    split_column: str,
    train_share: float,
    validation_share: float,
    test_share: float,
    random_state: int,
) -> dict[str, pd.DataFrame]:
    validate_split_shares(train_share, validation_share, test_share)
    if split_column not in frame.columns:
        raise ValueError(f"Split column '{split_column}' is missing from processed data")

    shuffled = frame.sample(frac=1, random_state=random_state)
    split_indexes = {"train": [], "validation": [], "test": []}
    for _, group in shuffled.groupby(split_column, sort=False):
        count = len(group)
        train_end = round(count * train_share)
        validation_end = train_end + round(count * validation_share)
        split_indexes["train"].extend(group.index[:train_end])
        split_indexes["validation"].extend(group.index[train_end:validation_end])
        split_indexes["test"].extend(group.index[validation_end:])

    return {
        split_name: frame.loc[indexes].sample(frac=1, random_state=random_state).reset_index(drop=True)
        for split_name, indexes in split_indexes.items()
    }


def write_processed_outputs(
    processed: pd.DataFrame,
    output_path: Path,
    split_column: str,
    train_share: float,
    validation_share: float,
    test_share: float,
    random_state: int,
) -> dict[str, Path]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    processed.to_csv(output_path, index=False)
    splits = split_frame(processed, split_column, train_share, validation_share, test_share, random_state)
    split_paths = {"full": output_path}
    for split_name, split in splits.items():
        path = split_output_path(output_path, split_name)
        split.to_csv(path, index=False)
        split_paths[split_name] = path
    return split_paths


def preprocess(
    input_path: Path,
    output_path: Path | None = None,
    metadata_column: str = DEFAULT_METADATA_COLUMN,
    dropped_metadata_keys: set[str] | None = None,
    min_data_schema_version: float = 6,
    game_mode: str | None = DEFAULT_GAME_MODE,
    dropped_columns: set[str] | None = None,
    split_column: str = DEFAULT_SPLIT_COLUMN,
    train_share: float = DEFAULT_TRAIN_SHARE,
    validation_share: float = DEFAULT_VALIDATION_SHARE,
    test_share: float = DEFAULT_TEST_SHARE,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> pd.DataFrame:
    dropped_metadata_keys = dropped_metadata_keys or set(DEFAULT_DROPPED_METADATA_KEYS)
    output_path = output_path or default_output_path(input_path)

    frame = pd.read_csv(input_path)
    if metadata_column not in frame.columns:
        raise ValueError(f"Metadata column '{metadata_column}' is missing from {input_path}")
    if "data_schema_version" not in frame.columns:
        raise ValueError(f"Column 'data_schema_version' is missing from {input_path}")

    frame["data_schema_version"] = pd.to_numeric(frame["data_schema_version"], errors="coerce")
    frame = frame[frame["data_schema_version"].ge(min_data_schema_version)]

    if game_mode:
        if "game_mode" not in frame.columns:
            raise ValueError(f"Column 'game_mode' is missing from {input_path}")
        frame = frame[frame["game_mode"].eq(game_mode)]

    frame = frame.reset_index(drop=True)

    metadata = pd.json_normalize(
        frame[metadata_column].map(lambda value: parse_metadata(value, dropped_metadata_keys))
    ).add_prefix("meta_")
    processed = pd.concat([frame.drop(columns=[metadata_column]), metadata], axis=1)

    dropped_columns = dropped_columns or set(DEFAULT_DROPPED_COLUMNS)
    processed = processed.drop(columns=[col for col in dropped_columns if col in processed.columns])
    processed = processed.dropna(axis=0, how="any").reset_index(drop=True)
    if "device_type" in processed.columns:
        processed = pd.get_dummies(processed, columns=["device_type"], prefix="device_type", dtype=int)

    write_processed_outputs(
        processed,
        output_path,
        split_column,
        train_share,
        validation_share,
        test_share,
        random_state,
    )
    return processed


def main() -> None:
    args = parse_args()
    processed = preprocess(
        input_path=args.input,
        output_path=args.output,
        metadata_column=args.metadata_column,
        dropped_metadata_keys=set(args.drop_metadata_key),
        min_data_schema_version=args.min_data_schema_version,
        game_mode=args.game_mode or None,
        dropped_columns=set(args.drop_column),
        split_column=args.split_column,
        train_share=args.train_share,
        validation_share=args.validation_share,
        test_share=args.test_share,
        random_state=args.random_state,
    )
    output_path = args.output or default_output_path(args.input)
    split_paths = {
        "full": output_path,
        "train": split_output_path(output_path, "train"),
        "validation": split_output_path(output_path, "validation"),
        "test": split_output_path(output_path, "test"),
    }
    print(f"Wrote {len(processed):,} rows and {processed.shape[1]:,} columns to {output_path}")
    for split_name in ["train", "validation", "test"]:
        split = pd.read_csv(split_paths[split_name])
        print(f"Wrote {split_name} split: {len(split):,} rows to {split_paths[split_name]}")


if __name__ == "__main__":
    main()
