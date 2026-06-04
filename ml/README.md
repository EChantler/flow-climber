# FlowClimb ML

This folder contains the machine-learning training environment and scripts for challenge-label models.

## Layout

- `environment.yml` — Conda environment for training/export.
- `data/` — place CSV exports here locally. CSV files are git-ignored.
- `models/` — ONNX outputs and model manifests. Generated model files are git-ignored until intentionally promoted.
- `scripts/preprocess_telemetry.py` — flattens raw telemetry metadata into a processed CSV for training.
- `scripts/train_models.py` — trains and exports all supported model candidates.
- `mlruns/` — local MLflow tracking output. Git-ignored.

## Setup

```bash
conda env create -f ml/environment.yml
conda activate flowclimb-ml
```

## Preprocessing

Create a processed training CSV from a raw telemetry export:

```bash
python ml/scripts/preprocess_telemetry.py \
  --input ml/data/raw/2026-05-30-21-02.csv \
  --output ml/data/processed/2026-05-30-21-02.processed.csv
```

The preprocessor filters to `data_schema_version >= 6` and `game_mode == "train"`, flattens the JSON `metadata` object into `meta_*` columns, drops the nested `failed_jump_counts` metadata dictionary, drops non-feature columns (`id`, `session_id`, `token_used`, `metric_value`, `event_type`, `created_at`, `game_version`, `game_mode`, `window_started_at`, `window_ended_at`, `data_schema_version`, `deployment_context`, `meta_logged_at`, `meta_window_duration_ms`, `meta_platform_height_avg_px`, `meta_platform_height_max_px`, and `meta_platform_height_min_px`), adds heuristic-aligned `height_delta` (`height_climbed - meta_window_starting_height`, clipped at 0) and `deaths_delta` (`meta_deaths`) features, removes rows with null values in any output column, one-hot encodes `device_type`, and writes full, training, validation, and test CSVs. By default the splits are stratified by `challenge_label` with 70% train, 15% validation, and 15% test.

## Training

Place or generate processed telemetry CSVs, then run:

```bash
python ml/scripts/train_models.py \
  --train-data ml/data/processed/2026-05-30-21-02.processed.train.csv \
  --validation-data ml/data/processed/2026-05-30-21-02.processed.validation.csv \
  --target challenge_label \
  --output-dir ml/models
```

The test split is reserved for a separate final-evaluation script and is not consumed by `train_models.py`.

For a diagnostic run that uses only the heuristic-aligned deaths/height features (`deaths_delta`, `height_delta`), use the duplicate script:

```bash
python ml/scripts/train_models_deaths_height.py \
  --train-data ml/data/processed/2026-06-01-20-38.processed.train.csv \
  --validation-data ml/data/processed/2026-06-01-20-38.processed.validation.csv \
  --target challenge_label
```

The script trains and exports these model candidates:

- `logistic_regression` — L2-regularized logistic regression on scaled features.
- `rbf_svc` — radial-basis-function SVM on scaled features.
- `random_forest` — balanced random forest classifier.
- `gradient_boosting` — gradient boosting classifier.
- `gaussian_nb` — Gaussian Naive Bayes with configured variance smoothing.

Each run is tracked in MLflow under the `flowclimb-challenge-models` experiment. By default, local MLflow files are written to `ml/mlruns`. Runs log dataset parameters, class distribution, train/validation row counts, validation accuracy, validation balanced accuracy, validation macro/weighted precision/recall/F1, validation per-class precision/recall/F1/support, train accuracy, validation classification reports, validation confusion matrices, permutation feature importance, and validation metrics with the heuristic features (`deaths_delta`, `height_delta`) zeroed out.

## MLflow UI

Start the local MLflow UI with:

```bash
conda run --no-capture-output -n flowclimb-conda python ml/scripts/mlflow_ui.py
```

The script prints the URL, usually:

`http://127.0.0.1:5000`

Open that exact URL. If the browser shows an MLflow `Access Denied` page, make sure you are not opening `http://0.0.0.0:5000`; MLflow validates browser Host headers for local security. The helper script passes port-specific localhost entries like `127.0.0.1:5000` and `localhost:5000` to MLflow's `--allowed-hosts` option.

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
- `<model_name>.validation_classification_report.json`
- `<model_name>.validation_confusion_matrix.json`
- `<model_name>.validation_confusion_matrix.png`
- `<model_name>.validation_metrics.png`
- `<model_name>.validation_per_class_f1.png`
- `<model_name>.validation_permutation_importance.csv`
- `<model_name>.validation_permutation_importance.json`
- `<model_name>.validation_permutation_importance.png`
- `<model_name>.validation_heuristic_features_zeroed_classification_report.json`
- `<model_name>.validation_heuristic_features_zeroed_confusion_matrix.json`
- `model_validation_metric_comparison.png`

It also writes `manifest.json`, which records the available ONNX files and feature order. The game loads promoted model artifacts from stable aliases in `src/models/flow/`:

- `active.onnx`
- `active.metadata.json`
- `manifest.json`

Promote a selected candidate without changing game JavaScript:

```bash
python ml/scripts/promote_model.py --model logistic_regression
```

Valid model names are currently `logistic_regression`, `rbf_svc`, `random_forest`, `gradient_boosting`, and `gaussian_nb`. The currently promoted Flow ML model is recorded in `src/models/flow/manifest.json` as `active_model`.

## CSV expectations

The CSV must include the target column passed with `--target`.

By default, the script uses the locked feature set:

```text
difficulty
meta_previous_difficulty
meta_jump_key_presses
meta_left_key_presses
meta_right_key_presses
meta_total_horizontal_movement_px
meta_skip_reward_total
meta_skipped_platforms
device_type_desktop
device_type_mobile
deaths_delta
height_delta
```

To override feature order explicitly for experiments, pass `--features ...`. Feature order matters for ONNX inference and is saved in every metadata file plus `manifest.json`.
