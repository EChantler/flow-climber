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
- `game_version` — runtime game version, e.g. `v0.15.13`.
- `data_schema_version` — telemetry schema version.
- `session_id` — run/session UUID generated in the browser. It resets when a new run starts/restarts or when the player returns to the menu.
- `deployment_context` — `local` or `deployed`. Local includes `file://`, localhost, loopback, wildcard dev hosts such as `[::]`/`0.0.0.0`, and private LAN hostnames used for local testing.
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

Detailed per-window metrics stay in `metadata`:

### Window timing and position

- `window_duration_ms`
- `vertical_position_y`
- `window_starting_height`

### Progress and score

- `jumps_landed_on_new_platforms`
- `new_platforms_reached`
- `height_climbed`
- `score`
- `flags_collected_total`
- `seconds_since_flag`

### Difficulty and platform context

- `previous_difficulty`
- `platform_width_min_px`
- `platform_width_max_px`
- `platform_width_avg_px`
- `platform_height_min_px`
- `platform_height_max_px`
- `platform_height_avg_px`
- `platform_gap_y_min_px`
- `platform_gap_y_max_px`
- `platform_gap_y_avg_px`
- `platform_x_shift_min_px`
- `platform_x_shift_max_px`
- `platform_speed_px_per_frame`

### Deaths, failed jumps, and skipped platforms

- `deaths`
- `deaths_total`
- `failed_jump_attempts`
- `distinct_failed_jumps`
- `repeated_failed_jump_attempts`
- `failed_jump_counts`
- `skipped_platforms`
- `skip_reward`
- `skip_reward_total`

### Input and movement

- `left_key_presses`
- `right_key_presses`
- `jump_key_presses`
- `total_horizontal_movement_px`

## Challenge-label generation

Each 10-second window receives exactly one `challenge_label`. The label is calculated before difficulty changes and is logged with the completed window.

### Current heuristic label logic

Train mode currently uses the shared heuristic labeler in `src/game-rules.js`:

```js
const lowUpwardProgress = features.heightDelta < 200

if (features.deathsDelta >= 2 && lowUpwardProgress) {
  return FLOWCLIMB_CHALLENGE_LABELS.OVER
}
if (features.deathsDelta <= 1 && !lowUpwardProgress) {
  return FLOWCLIMB_CHALLENGE_LABELS.UNDER
}
return FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE
```

Interpretation:

- `over_challenged` — the player died at least twice in the window and climbed less than 200px.
- `under_challenged` — the player died at most once and climbed at least 200px.
- `appropriately_challenged` — everything in between.

Flow ML mode uses the promoted ONNX model when enabled. If that model is not ready, fails to load, or prediction fails, FlowClimb blocks play instead of silently falling back.

### Current model feature object

The current heuristic/ONNX prediction path builds these derived features before the label is assigned:

- `elapsedSeconds`
- `intervalSeconds`
- `flagsDelta`
- `deathsDelta`
- `heightDelta`
- `heightPerMinute`
- `flagsPerMinute`
- `intervalFlagsPerMinute`
- `deathsPerMinute`
- `intervalDeathsPerMinute`
- `secondsSinceFlag`
- `difficulty`

## Candidate ML training features

For model training, `challenge_label` is the target and should not be used as an input feature.

Useful input feature candidates include:

### Core window features

- deaths in the window: `deaths`
- height climbed in the window: `height_climbed - window_starting_height`
- total height climbed: `height_climbed`
- horizontal distance traveled: `total_horizontal_movement_px`
- left/right/jump input counts: `left_key_presses`, `right_key_presses`, `jump_key_presses`
- new platforms reached: `new_platforms_reached`
- jumps landed on new platforms: `jumps_landed_on_new_platforms`
- current difficulty: `difficulty`
- previous difficulty: `previous_difficulty`
- window index or elapsed run time: `window_index`, `window_duration_ms`

### Failure/struggle features

- failed jump attempts: `failed_jump_attempts`
- distinct failed jumps: `distinct_failed_jumps`
- repeated failed jump attempts: `repeated_failed_jump_attempts`
- skipped platforms: `skipped_platforms`

### Performance/rate features

- height per minute
- deaths per minute
- jumps per minute
- horizontal movement per minute
- new platforms reached per minute
- seconds since last flag: `seconds_since_flag`
- score: `score`

### Level-generation context

These help separate player performance from level layout difficulty:

- platform width min/max/avg
- platform gap Y min/max/avg
- platform X-shift min/max
- platform speed
- platform height min/max/avg

### Aggregate/context features

- total deaths: `deaths_total`
- total flags collected: `flags_collected_total`
- device type: `device_type` can be used for stratified evaluation or as a model feature if mobile/desktop behavior differs.

Avoid using participant identifiers, raw tokens, `session_id`, `deployment_context`, or timestamps as direct model features unless there is a specific experimental reason.

## Schema changes

When telemetry data shape changes:

1. Update Supabase columns if needed.
2. Increment `TELEMETRY_SCHEMA_VERSION` in `src/game.js`.
3. Bump `GAME_VERSION`, `index.html` script query params, and `package.json`.
4. Add or update tests.
5. Run `npm test` and `git diff --check`.
6. Keep a data version control log in this file.
