# Architecture

FlowClimb is a static Phaser game loaded from `index.html`.

## File layout

- `index.html` — page shell, touch controls, telemetry config, and script loading.
- `src/game.js` — main Phaser scene, game loop, UI, movement/collision, difficulty updates, and orchestration.
- `src/flow-constants.js` — shared study/schema labels for modes, models, and challenge labels.
- `src/challenge-models.js` — heuristic challenge-label prediction and legacy JavaScript model logic for non-ONNX model experiments.
- `src/onnx-challenge-model.js` — browser ONNX Runtime wrapper for trained challenge-label models.
- `src/models/flow/` — promoted ONNX model artifacts used by the deployed game.
- `src/telemetry-window.js` — pure helper for building 10-second telemetry payloads.
- `src/telemetry.js` — Supabase telemetry buffer/flush manager.
- `src/spawn-worker.js` — worker used to pre-generate platforms.
- `tests/` — Node test suite using `node --test`.
- `ml/` — Conda-based training environment, MLflow tracking setup, CSV input location, and ONNX model export scripts.

## Script load order

`index.html` must load scripts in dependency order:

1. `src/flow-constants.js`
2. `src/challenge-models.js`
3. `src/onnx-challenge-model.js`
4. `src/telemetry-window.js`
5. `src/telemetry.js`
6. `src/game.js`

`src/game.js` depends on the globals exported by the earlier scripts.

## Difficulty and telemetry order

At the end of each 10-second window:

1. The latest telemetry window is collected.
2. The telemetry row is logged/sent.
3. Difficulty is adjusted for the next window.

This protects analysis by ensuring telemetry describes the completed window before any next-window difficulty change.

## Challenge labels

Train mode uses the same heuristic challenge-label model as Flow heuristic mode. Flow ML mode attempts to use the promoted LogisticRegression ONNX model in `src/models/flow/logistic_regression.onnx` through `src/onnx-challenge-model.js`.

If ONNX Runtime or the model asset is unavailable, the game shows a blocking error asking the player to notify the developer. Flow ML must not silently fall back to a different model because that would contaminate study-condition labels.

Browsers block model fetches from `file://` pages, so local testing must use an HTTP static server such as `python3 -m http.server 8000`.

Candidate trained models live under `ml/` and are exported as ONNX files with a shared manifest/metadata shape. LogisticRegression, LinearSVC, and GaussianNB candidates should use the same feature order so the game can swap between them without gameplay-code changes.
