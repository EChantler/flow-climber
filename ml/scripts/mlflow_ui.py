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
    parser.add_argument(
        "--allowed-hosts",
        default=None,
        help="Comma-separated Host headers accepted by MLflow's local security middleware.",
    )
    parser.add_argument(
        "--cors-allowed-origins",
        default=None,
        help="Comma-separated CORS origins accepted by MLflow's local security middleware.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    tracking_dir = args.tracking_dir.resolve()
    tracking_dir.mkdir(parents=True, exist_ok=True)
    backend_store_uri = tracking_dir.as_uri()
    url = f"http://{args.host}:{args.port}"
    allowed_hosts = args.allowed_hosts or ",".join([
        f"127.0.0.1:{args.port}",
        f"localhost:{args.port}",
        "127.0.0.1",
        "localhost",
    ])
    cors_allowed_origins = args.cors_allowed_origins or ",".join([
        f"http://127.0.0.1:{args.port}",
        f"http://localhost:{args.port}",
    ])

    print(f"Starting MLflow UI at {url}", flush=True)
    print(f"Backend store URI: {backend_store_uri}", flush=True)
    print(f"Allowed hosts: {allowed_hosts}", flush=True)
    print("If the browser shows Access Denied, open the exact URL above instead of http://0.0.0.0:5000.", flush=True)
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
        "--allowed-hosts",
        allowed_hosts,
        "--cors-allowed-origins",
        cors_allowed_origins,
    ], check=True)


if __name__ == "__main__":
    main()
