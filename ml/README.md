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

## Outputs

For each model candidate, the script writes:

- `<model_name>.onnx`
- `<model_name>.metadata.json`

It also writes `manifest.json`, which records the available ONNX files and feature order. The game loads promoted model artifacts from `src/models/flow/`; copy a selected `.onnx` file plus metadata there when intentionally promoting a candidate for gameplay use.

The currently promoted Flow ML model is `src/models/flow/logistic_regression.onnx`.

## CSV expectations

The CSV must include the target column passed with `--target`.

By default, the script uses all numeric columns except the target as model features. To lock feature order explicitly, pass:

```bash
--features height_delta flags_delta deaths_delta seconds_since_flag difficulty
```

Feature order matters for ONNX inference and is saved in every metadata file plus `manifest.json`.
