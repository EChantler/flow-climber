#!/usr/bin/env python3
"""Start the local MLflow UI for FlowClimb training runs."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--tracking-dir", type=Path, default=Path("ml/mlruns"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    tracking_dir = args.tracking_dir.resolve()
    tracking_dir.mkdir(parents=True, exist_ok=True)
    backend_store_uri = tracking_dir.as_uri()
    url = f"http://{args.host}:{args.port}"

    print(f"Starting MLflow UI at {url}", flush=True)
    print(f"Backend store URI: {backend_store_uri}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)

    subprocess.run([
        "python",
        "-m",
        "mlflow",
        "ui",
        "--backend-store-uri",
        backend_store_uri,
        "--host",
        args.host,
        "--port",
        str(args.port),
    ], check=True)


if __name__ == "__main__":
    main()
