# FlowClimb ML

This folder contains the machine-learning training environment and scripts for challenge-label models.

## Layout

- `environment.yml` — Conda environment for training/export.
- `data/` — place CSV exports here locally. CSV files are git-ignored.
- `models/` — ONNX outputs and model manifests. Generated model files are git-ignored until intentionally promoted.
- `scripts/train_models.py` — trains and exports all supported model candidates.
- `mlruns/` — local MLflow tracking output. Git-ignored.

## Setup

```bash
conda env create -f ml/environment.yml
conda activate flowclimb-ml
```

## Training

Place the telemetry CSV export at `ml/data/flowclimb_export.csv`, then run:

```bash
python ml/scripts/train_models.py \
  --data ml/data/flowclimb_export.csv \
  --target challenge_label \
  --output-dir ml/models
```

The script trains and exports these model candidates:

- `logistic_regression`
- `linear_svc`
- `gaussian_nb`

Each run is tracked in MLflow under the `flowclimb-challenge-models` experiment. By default, local MLflow files are written to `ml/mlruns`.

## MLflow UI

Start the local MLflow UI with:

```bash
conda run --no-capture-output -n flowclimb-conda python ml/scripts/mlflow_ui.py
```

The script prints the URL, usually:

`http://127.0.0.1:5000`

You can override the port if needed:

```bash
conda run --no-capture-output -n flowclimb-conda python ml/scripts/mlflow_ui.py --port 5001
```

Equivalent direct MLflow command:

```bash
conda run --no-capture-output -n flowclimb-conda \
  python -m mlflow ui \
  --backend-store-uri "file://$(pwd)/ml/mlruns" \
  --host 127.0.0.1 \
  --port 5000
```

## Outputs

For each model candidate, the script writes:

- `<model_name>.onnx`
- `<model_name>.metadata.json`

It also writes `manifest.json`, which records the available ONNX files and feature order. The game loads promoted model artifacts from stable aliases in `src/models/flow/`:

- `active.onnx`
- `active.metadata.json`
- `manifest.json`

Promote a selected candidate without changing game JavaScript:

```bash
python ml/scripts/promote_model.py --model logistic_regression
```

Valid model names are currently `logistic_regression`, `linear_svc`, and `gaussian_nb`. The currently promoted Flow ML model is recorded in `src/models/flow/manifest.json` as `active_model`.

## CSV expectations

The CSV must include the target column passed with `--target`.

By default, the script uses all numeric columns except the target as model features. To lock feature order explicitly, pass:

```bash
--features height_delta flags_delta deaths_delta seconds_since_flag difficulty
```

Feature order matters for ONNX inference and is saved in every metadata file plus `manifest.json`.
