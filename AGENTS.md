# Repository Instructions

## Versioning

Always update the version when making any code, behavior, telemetry, UI, test, documentation, or deployment-related change.

Update all three places together:

- `src/game.js`: `GAME_VERSION = "vX.Y.Z"`
- `index.html`: cache-busting query params for every local `src/*.js` script tag
- `package.json`: `version` without the leading `v`

Increment methodology:

- **Minor** `vX.Y.Z -> vX.Y.(Z+1)`: small UI/copy changes, bug fixes, tests, docs, refactors, cache-busting.
- **Mid** `vX.Y.Z -> vX.(Y+1).0`: meaningful features or study-behavior changes, new modes/screens/controls, difficulty/model changes, telemetry schema additions or renames, significant tuning.
- **Major** `vX.Y.Z -> v(X+1).0.0`: breaking or study-invalidating changes, incompatible telemetry changes, core gameplay/storage/access rewrites, changes that make older data not directly comparable.

## Testing

Run tests before committing changes:

```bash
npm test
```

When making a meaningful change or addition, add or update tests that guard the new behavior and prevent regressions.

## Telemetry

Treat telemetry field names as study schema. Do not rename or remove telemetry fields without an appropriate mid/major version bump and tests.

If the telemetry data schema changes, update `TELEMETRY_SCHEMA_VERSION` in `src/game.js` and ensure the `data_schema_version` telemetry column receives the new value.

Preserve the 10-second window order:

1. Collect telemetry
2. Send telemetry
3. Adjust difficulty

## Machine learning

ML training scaffolding lives in `ml/`. Do not commit local CSV exports, generated ONNX files, MLflow runs, or other generated training artifacts unless intentionally promoting a model artifact for game use. Promoted browser-consumed model artifacts live under `src/models/flow/`.

After running ML training, present the resulting metrics, suggest possible learnings from the run, and ask what should be added to `ml/TRAINING_NOTES.md` before updating the notes.

## Safety

Do not add new secrets or tokens. If telemetry config changes, prefer documented configuration over hardcoding.

## Commit hygiene

- Do not commit `session-*.md` files.
- Commit related code, tests, and version bumps together.
- Before committing, run `npm test` and `git diff --check`.
