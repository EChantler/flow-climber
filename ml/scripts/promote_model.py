#!/usr/bin/env python3
"""Promote a trained FlowClimb ONNX model to the stable browser model path."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Model name to promote, e.g. logistic_regression, linear_svc, gaussian_nb.")
    parser.add_argument("--models-dir", type=Path, default=Path("ml/models"))
    parser.add_argument("--output-dir", type=Path, default=Path("src/models/flow"))
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    source_onnx = args.models_dir / f"{args.model}.onnx"
    source_metadata = args.models_dir / f"{args.model}.metadata.json"
    source_manifest = args.models_dir / "manifest.json"

    for path in [source_onnx, source_metadata, source_manifest]:
        if not path.exists():
            raise FileNotFoundError(f"Missing required model artifact: {path}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    active_onnx = args.output_dir / "active.onnx"
    active_metadata = args.output_dir / "active.metadata.json"
    active_manifest = args.output_dir / "manifest.json"

    shutil.copyfile(source_onnx, active_onnx)

    metadata = read_json(source_metadata)
    metadata["promoted_model_name"] = metadata.get("model_name", args.model)
    metadata["onnx_file"] = active_onnx.name
    write_json(active_metadata, metadata)

    manifest = read_json(source_manifest)
    manifest["active_model"] = args.model
    manifest["active_onnx_file"] = active_onnx.name
    manifest["active_metadata_file"] = active_metadata.name
    write_json(active_manifest, manifest)

    print(f"Promoted {args.model} to {active_onnx} and {active_metadata}")


if __name__ == "__main__":
    main()
