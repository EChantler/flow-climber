# Telemetry

FlowClimb records gameplay telemetry once per 10-second window. The ordering is important:

1. Collect the completed window's telemetry.
2. Log/send that telemetry.
3. Adjust difficulty for the next window.

The current telemetry schema version is `6`, tracked in `src/game.js` as:

```js
const TELEMETRY_SCHEMA_VERSION = 6
```

## Supabase columns

The `telemetry` table stores frequently queried study fields as top-level columns and detailed window metrics in `metadata` JSON.

Expected top-level columns:

- `token_used` — participant/access token used for insert authorization.
- `event_type` — currently `telemetry_window` for gameplay telemetry.
- `metric_value` — currently the window score value.
- `game_version` — runtime game version, e.g. `v0.10.0`.
- `data_schema_version` — telemetry schema version.
- `session_id` — run/session UUID generated in the browser.
- `deployment_context` — `local` or `deployed`.
- `device_type` — `mobile` or `desktop`.
- `game_mode` — `train`, `flow-heuristic`, or `flow-ML`.
- `window_index` — zero-based telemetry window index within a run.
- `window_started_at` — ISO timestamp for the window start.
- `window_ended_at` — ISO timestamp for the window end.
- `difficulty` — difficulty during the logged window.
- `score` — score during the logged window.
- `height_climbed` — total height climbed by the end of the window.
- `challenge_label` — `under_challenged`, `over_challenged`, or `appropriately_challenged`.
- `metadata` — JSON payload for detailed metrics.
- `created_at` — Supabase insertion timestamp.

## Metadata JSON

Detailed per-window metrics stay in `metadata`, including:

- movement/input counts
- deaths within the window
- skipped-platform rewards/counts
- failed-jump counts by jump key
- platform generation parameters for current difficulty
- total flags/deaths
- seconds since flag

## Schema changes

When telemetry data shape changes:

1. Update Supabase columns if needed.
2. Increment `TELEMETRY_SCHEMA_VERSION` in `src/game.js`.
3. Bump `GAME_VERSION`, `index.html` script query params, and `package.json`.
4. Add or update tests.
5. Run `npm test` and `git diff --check`.
