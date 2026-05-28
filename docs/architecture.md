# Architecture

FlowClimb is a static Phaser game loaded from `index.html`.

## File layout

- `index.html` — page shell, touch controls, telemetry config, and script loading.
- `src/game.js` — main Phaser scene shell, `create` setup, game loop, movement/collision, and Phaser boot config.
- `src/run-state.js` — run startup/reset, score/height, death tracking, failed-jump, and unstuck helper methods mixed into the Phaser scene.
- `src/game-rules.js` — gameplay constants, tuning values, background stops, Flow model candidates, heuristic challenge-label helper, and difficulty/model scene methods.
- `src/ui.js` — scene UI/menu/HUD/display helper methods mixed into the Phaser scene.
- `src/input.js` — keyboard/touch input helper methods mixed into the Phaser scene.
- `src/game-telemetry.js` — scene telemetry/config/access-control/device-context helper methods plus telemetry-window payload builder.
- `src/platforms.js` — platform generation, reachability, movement, objective, and spawn-worker helper methods mixed into the Phaser scene.
- `src/rendering.js` — world drawing, coordinate transforms, and color helpers mixed into the Phaser scene.
- `src/flow-constants.js` — shared study/schema labels for modes, models, and challenge labels.
- `src/onnx-challenge-model.js` — browser ONNX Runtime wrapper for trained challenge-label models.
- `src/models/flow/` — promoted ONNX model artifacts used by the deployed game.
- `src/telemetry.js` — Supabase telemetry buffer/flush manager.
- `src/spawn-worker.js` — worker used to pre-generate platforms.
- `tests/` — Node test suite using `node --test`.
- `ml/` — Conda-based training environment, MLflow tracking setup, CSV input location, and ONNX model export scripts.

## Script load order

`index.html` must load scripts in dependency order:

1. `src/flow-constants.js`
2. `src/game-rules.js`
3. `src/onnx-challenge-model.js`
4. `src/telemetry.js`
5. `src/ui.js`
6. `src/input.js`
7. `src/game-telemetry.js`
8. `src/platforms.js`
9. `src/rendering.js`
10. `src/run-state.js`
11. `src/game.js`

`src/game.js` depends on the globals exported by the earlier scripts.

## Difficulty and telemetry order

At the end of each 10-second window:

1. The latest telemetry window is collected.
2. The telemetry row is logged/sent.
3. Difficulty is adjusted for the next window.

This protects analysis by ensuring telemetry describes the completed window before any next-window difficulty change.

## Challenge labels

Train mode uses the same heuristic challenge-label model as Flow heuristic mode. Flow ML mode attempts to use the promoted ONNX model at `src/models/flow/active.onnx` through `src/onnx-challenge-model.js`. The active model identity is recorded in `src/models/flow/manifest.json`.

If ONNX Runtime or the model asset is unavailable, the game shows a blocking error asking the player to notify the developer. Flow ML must not silently fall back to a different model because that would contaminate study-condition labels.

Browsers block model fetches from `file://` pages, so local testing must use an HTTP static server such as `python3 -m http.server 8000`.

Candidate trained models live under `ml/` and are exported as ONNX files with a shared manifest/metadata shape. LogisticRegression, LinearSVC, and GaussianNB candidates should use the same feature order. Use `python ml/scripts/promote_model.py --model <name>` to update the stable `active.*` browser artifacts without gameplay-code changes.
