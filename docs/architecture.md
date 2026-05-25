# Architecture

FlowClimb is a static Phaser game loaded from `index.html`.

## File layout

- `index.html` — page shell, touch controls, telemetry config, and script loading.
- `src/game.js` — main Phaser scene, game loop, UI, movement/collision, difficulty updates, and orchestration.
- `src/flow-constants.js` — shared study/schema labels for modes, models, and challenge labels.
- `src/challenge-models.js` — challenge-label prediction logic.
- `src/telemetry-window.js` — pure helper for building 10-second telemetry payloads.
- `src/telemetry.js` — Supabase telemetry buffer/flush manager.
- `src/spawn-worker.js` — worker used to pre-generate platforms.
- `tests/` — Node test suite using `node --test`.

## Script load order

`index.html` must load scripts in dependency order:

1. `src/flow-constants.js`
2. `src/challenge-models.js`
3. `src/telemetry-window.js`
4. `src/telemetry.js`
5. `src/game.js`

`src/game.js` depends on the globals exported by the earlier scripts.

## Difficulty and telemetry order

At the end of each 10-second window:

1. The latest telemetry window is collected.
2. The telemetry row is logged/sent.
3. Difficulty is adjusted for the next window.

This protects analysis by ensuring telemetry describes the completed window before any next-window difficulty change.

## Challenge labels

Train mode uses the same heuristic challenge-label model as Flow heuristic mode. Flow ML mode uses the logistic-regression-style model. This shared logic lives in `src/challenge-models.js`.
