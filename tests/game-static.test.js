const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const gameSource = () => fs.readFileSync('src/game.js', 'utf8')
const telemetryWindowSource = () => fs.readFileSync('src/telemetry-window.js', 'utf8')
const constantsSource = () => fs.readFileSync('src/flow-constants.js', 'utf8')
const onnxModelSource = () => fs.readFileSync('src/onnx-challenge-model.js', 'utf8')
const indexSource = () => fs.readFileSync('index.html', 'utf8')

test('browser scripts are syntactically valid JavaScript', () => {
  for (const file of ['src/flow-constants.js', 'src/onnx-challenge-model.js', 'src/telemetry-window.js', 'src/game.js', 'src/telemetry.js', 'src/spawn-worker.js']) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  }
})

test('game version matches index cache-busting query params and package version', () => {
  const game = gameSource()
  const index = indexSource()
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  assert.equal(packageJson.scripts.start, 'python3 -m http.server 8000')
  const version = game.match(/const GAME_VERSION = "([^"]+)"/)?.[1]
  assert.ok(version, 'GAME_VERSION should be declared')
  const cacheVersion = version.replace(/^v/, '')
  for (const script of ['flow-constants.js', 'onnx-challenge-model.js', 'telemetry-window.js', 'telemetry.js', 'game.js']) {
    assert.match(index, new RegExp(`src/${script}\\?v=${cacheVersion}`))
  }
  assert.equal(packageJson.version, cacheVersion)
})

test('repeated telemetry values are configured as top-level columns', () => {
  const game = gameSource()
  const telemetry = fs.readFileSync('src/telemetry.js', 'utf8')
  assert.match(game, /gameVersion: GAME_VERSION/)
  for (const column of [
    'game_version',
    'data_schema_version',
    'deployment_context',
    'session_id',
    'device_type',
    'game_mode',
    'window_index',
    'window_started_at',
    'window_ended_at',
    'difficulty',
    'score',
    'height_climbed',
    'challenge_label',
  ]) {
    assert.match(telemetry, new RegExp(`${column}[:,]`), `missing top-level telemetry column ${column}`)
  }
})

test('data schema version is tracked as a top-level telemetry column', () => {
  const game = gameSource()
  assert.match(game, /const TELEMETRY_SCHEMA_VERSION = 6/)
  assert.match(game, /telemetrySchemaVersion: TELEMETRY_SCHEMA_VERSION/)
  assert.match(telemetryWindowSource(), /data_schema_version: input\.telemetrySchemaVersion/)
  assert.doesNotMatch(game, /(^|[^a-zA-Z_])schema_version:/)
})

test('only 10-second telemetry window events are logged from gameplay', () => {
  const game = gameSource()
  const eventTypes = [...game.matchAll(/this\.logTelemetry\("([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(eventTypes, ['telemetry_window'])
  assert.match(game, /const DIFFICULTY_UPDATE_INTERVAL_MS = 10000/)
  assert.match(game, /windowEndTimestamp = this\.lastTelemetryWindowTimestamp \+ DIFFICULTY_UPDATE_INTERVAL_MS/)
  assert.match(telemetryWindowSource(), /window_duration_ms: input\.windowEndTimestamp - input\.windowTelemetry\.windowStartTimestamp/)
})

test('train mode uses shared heuristic challenge label for telemetry', () => {
  const game = gameSource()
  assert.match(game, /const predictedLabel = await this\.predictChallengeLabelForMode\(latestTelemetry\)/)
  assert.match(game, /function predictFlowClimbHeuristicChallengeLabel\(features\)/)
  assert.match(game, /return predictFlowClimbHeuristicChallengeLabel\(features\)/)
  assert.doesNotMatch(game, /predictFlowClimbChallengeLabelForMode\(/)
  assert.doesNotMatch(game, /predictFlowClimbLogisticRegressionChallengeLabel/)
  assert.match(telemetryWindowSource(), /challenge_label: input\.predictedLabel/)
})

test('10-second window collects telemetry, sends it, then adjusts difficulty', () => {
  const game = gameSource()
  const body = game.match(/  async updateDifficultyFromElapsedTime\(\) \{([\s\S]*?)\n  \}\n\n  logTelemetryWindow/)?.[1]
  assert.ok(body, 'updateDifficultyFromElapsedTime body should be found')

  const collectIndex = body.indexOf('const latestTelemetry = this.getLatestTelemetryWindow(windowEndTimestamp)')
  const sendIndex = body.indexOf('this.logTelemetryWindow(latestTelemetry, previousDifficulty, predictedLabel, windowEndTimestamp)')
  const flowAdjustIndex = body.indexOf('this.difficultyLevel = Math.min(DIFFICULTY_MAX, this.difficultyLevel + FLOW_DIFFICULTY_STEP)')
  const trainAdjustIndex = body.indexOf('this.difficultyLevel = Phaser.Math.Clamp(timedDifficulty, DIFFICULTY_MIN, DIFFICULTY_MAX)')

  assert.notEqual(collectIndex, -1, 'telemetry should be collected')
  assert.notEqual(sendIndex, -1, 'telemetry should be sent/logged')
  assert.notEqual(flowAdjustIndex, -1, 'flow difficulty adjustment should exist')
  assert.notEqual(trainAdjustIndex, -1, 'train difficulty adjustment should exist')
  assert.ok(collectIndex < sendIndex, 'telemetry collection should happen before send')
  assert.ok(sendIndex < flowAdjustIndex, 'flow difficulty should adjust after send')
  assert.ok(sendIndex < trainAdjustIndex, 'train difficulty should adjust after send')
})

test('telemetry window payload contains the study fields', () => {
  const telemetryWindow = telemetryWindowSource()
  const requiredFields = [
    'window_index',
    'vertical_position_y',
    'jumps_landed_on_new_platforms',
    'new_platforms_reached',
    'deaths',
    'skipped_platforms',
    'skip_reward',
    'skip_reward_total',
    'failed_jump_attempts',
    'distinct_failed_jumps',
    'repeated_failed_jump_attempts',
    'failed_jump_counts',
    'total_horizontal_movement_px',
    'left_key_presses',
    'right_key_presses',
    'jump_key_presses',
    'platform_width_min_px',
    'platform_width_max_px',
    'platform_gap_y_min_px',
    'platform_gap_y_max_px',
    'platform_speed_px_per_frame',
    'difficulty',
    'height_climbed',
    'window_starting_height',
    'game_mode',
    'deployment_context',
    'device_type',
    'score',
  ]

  for (const field of requiredFields) {
    assert.match(telemetryWindow, new RegExp(`${field}:`), `missing telemetry field ${field}`)
  }
})

test('deployment context is tracked as a top-level local or deployed column', () => {
  const game = gameSource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(game, /deploymentContext: this\.currentDeploymentContext\(\)/)
  assert.match(game, /currentDeploymentContext\(\)/)
  assert.match(game, /hostname === "\[::\]"/)
  assert.match(game, /hostname === "0\.0\.0\.0"/)
  assert.match(game, /hostname\.startsWith\("192\.168\."\)/)
  assert.match(game, /return isLocal \? "local" : "deployed"/)
  assert.match(telemetryWindow, /deployment_context: input\.deploymentContext/)
})

test('device type is tracked as a top-level mobile or desktop column', () => {
  const game = gameSource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(game, /deviceType: this\.currentDeviceType\(\)/)
  assert.match(telemetryWindow, /device_type: input\.deviceType/)
  assert.match(game, /currentDeviceType\(\)/)
  assert.match(game, /return \(coarsePointer \|\| \(touchCapable && narrowViewport\)\) \? "mobile" : "desktop"/)
  assert.doesNotMatch(telemetryWindow, /screen_orientation:/)
})

test('skipped platforms are rewarded and tracked without missed-platform penalties', () => {
  const game = gameSource()
  const telemetryWindow = telemetryWindowSource()
  assert.doesNotMatch(game, /MISSED_FLAG_PENALTY/)
  assert.match(game, /const SKIPPED_PLATFORM_REWARD = 2/)
  assert.match(game, /this\.skipReward \+= reward/)
  assert.match(game, /this\.incrementWindowCounter\("skippedPlatforms", skippedCount\)/)
  assert.match(game, /this\.incrementWindowCounter\("skipReward", reward\)/)
  assert.match(game, /this\.score = this\.flagsCollected \+ this\.skipReward - this\.deathPenalty/)
  assert.match(telemetryWindow, /skipped_platforms: input\.windowTelemetry\.skippedPlatforms/)
  assert.match(game, /showScoreIndicator\(`\+\$\{reward\} skip`/)
})

test('failed jumps are tracked by specific jump key', () => {
  const game = gameSource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(game, /failedJumpAttempts: 0/)
  assert.match(game, /failedJumpCountsByJump: \{\}/)
  assert.match(game, /recordFailedJumpAttempt\(\)/)
  assert.match(game, /const jumpKey = `\$\{fromId\}->\$\{toId\}`/)
  assert.match(telemetryWindow, /repeated_failed_jump_attempts: repeatedFailedJumpAttempts/)
  assert.match(telemetryWindow, /distinct_failed_jumps: Object\.keys\(failedJumpCounts\)\.length/)
})

test('telemetry window shows a subtle short upload indicator', () => {
  const game = gameSource()
  assert.match(game, /this\.uploadIcon = this\.add\.text\(14, SCREEN_HEIGHT - 28, "↥"/)
  assert.match(game, /this\.flashUploadIcon\(\)\n    this\.logTelemetry\("telemetry_window"/)
  assert.match(game, /this\.time\.delayedCall\(100/)
})

test('menu modes and model display behavior are wired', () => {
  const game = gameSource()
  const constants = constantsSource()
  assert.match(game, /makeButton\(390, "Train mode", FLOWCLIMB_MODES\.TRAIN\)/)
  assert.match(game, /makeButton\(470, "Flow mode — coming soon", FLOWCLIMB_MODES\.FLOW, \{ enabled: false \}\)/)
  assert.match(game, /if \(visible && button\.menuEnabled\)/)
  assert.match(game, /FLOW_MODEL_NAMES = \[/)
  assert.match(game, /this\.selectedFlowModel = mode === FLOWCLIMB_MODES\.FLOW \? Phaser\.Utils\.Array\.GetRandom\(FLOW_MODEL_NAMES\) : null/)
  assert.match(constants, /PROMOTED_ONNX: "promoted_onnx"/)
  assert.match(game, /this\.modelText\.setVisible\(this\.gameMode === FLOWCLIMB_MODES\.FLOW\)/)
  assert.match(game, /Flow model: \$\{this\.flowModelDisplayName\(\)\}/)
  assert.match(game, /promoted_model_name/)
  assert.match(game, /Flow: adaptive difficulty is coming soon\./)
  assert.match(game, /FLOWCLIMB_GAME_MODE_LABELS\.FLOW_ML/)
})

test('flow ML model loads active ONNX model with blocking failure behavior', () => {
  const game = gameSource()
  const onnxModel = onnxModelSource()
  const index = indexSource()
  assert.match(index, /onnxruntime-web@1\.20\.1\/dist\/ort\.min\.js/)
  assert.match(onnxModel, /active\.onnx/)
  assert.match(onnxModel, /active\.metadata\.json/)
  assert.match(onnxModel, /feature_columns\.map/)
  assert.match(game, /this\.flowOnnxModel = createFlowClimbOnnxChallengeModel\(\)/)
  assert.match(game, /const onnxLabel = await this\.flowOnnxModel\.predict\(features\)/)
  assert.match(game, /ONNX models cannot load from file:\/\//)
  assert.match(game, /this\.blockAccess\("Flow model failed to load", hint\)/)
  assert.match(game, /this\.blockAccess\("Flow model prediction failed", "Please notify the developer and include this message\."\)/)
  assert.doesNotMatch(game, /falling back to JS model/)
  assert.ok(fs.existsSync('src/models/flow/active.onnx'))
  assert.ok(fs.existsSync('src/models/flow/active.metadata.json'))
  const manifest = JSON.parse(fs.readFileSync('src/models/flow/manifest.json', 'utf8'))
  assert.equal(manifest.active_model, 'gaussian_nb')
})

test('removed sudden death UI wording', () => {
  assert.doesNotMatch(gameSource(), /sudden death/i)
})
