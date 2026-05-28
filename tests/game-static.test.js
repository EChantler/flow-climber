const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const gameSource = () => fs.readFileSync('src/game.js', 'utf8')
const telemetryWindowSource = () => fs.readFileSync('src/game-telemetry.js', 'utf8')
const gameRulesSource = () => fs.readFileSync('src/game-rules.js', 'utf8')
const uiSource = () => fs.readFileSync('src/ui.js', 'utf8')
const inputSource = () => fs.readFileSync('src/input.js', 'utf8')
const gameTelemetrySource = () => fs.readFileSync('src/game-telemetry.js', 'utf8')
const platformsSource = () => fs.readFileSync('src/platforms.js', 'utf8')
const renderingSource = () => fs.readFileSync('src/rendering.js', 'utf8')
const runStateSource = () => fs.readFileSync('src/run-state.js', 'utf8')
const constantsSource = () => fs.readFileSync('src/flow-constants.js', 'utf8')
const onnxModelSource = () => fs.readFileSync('src/onnx-challenge-model.js', 'utf8')
const indexSource = () => fs.readFileSync('index.html', 'utf8')

test('browser scripts are syntactically valid JavaScript', () => {
  for (const file of ['src/flow-constants.js', 'src/game-rules.js', 'src/onnx-challenge-model.js', 'src/ui.js', 'src/input.js', 'src/game-telemetry.js', 'src/platforms.js', 'src/rendering.js', 'src/run-state.js', 'src/game.js', 'src/telemetry.js', 'src/spawn-worker.js']) {
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
  for (const script of ['flow-constants.js', 'game-rules.js', 'onnx-challenge-model.js', 'telemetry.js', 'ui.js', 'input.js', 'game-telemetry.js', 'platforms.js', 'rendering.js', 'run-state.js', 'game.js']) {
    assert.match(index, new RegExp(`src/${script}\\?v=${cacheVersion}`))
  }
  assert.equal(packageJson.version, cacheVersion)
})

test('repeated telemetry values are configured as top-level columns', () => {
  const game = gameSource()
  const telemetry = fs.readFileSync('src/telemetry.js', 'utf8')
  assert.match(gameTelemetrySource(), /gameVersion: GAME_VERSION/)
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
  assert.match(gameTelemetrySource(), /telemetrySchemaVersion: TELEMETRY_SCHEMA_VERSION/)
  assert.match(telemetryWindowSource(), /data_schema_version: input\.telemetrySchemaVersion/)
  assert.doesNotMatch(game, /(^|[^a-zA-Z_])schema_version:/)
})

test('only 10-second telemetry window events are logged from gameplay', () => {
  const gameRules = gameRulesSource()
  const eventTypes = [...gameTelemetrySource().matchAll(/this\.logTelemetry\("([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(eventTypes, ['telemetry_window'])
  assert.match(gameRulesSource(), /const DIFFICULTY_UPDATE_INTERVAL_MS = 10000/)
  assert.match(gameRules, /windowEndTimestamp = this\.lastTelemetryWindowTimestamp \+ DIFFICULTY_UPDATE_INTERVAL_MS/)
  assert.match(telemetryWindowSource(), /window_duration_ms: input\.windowEndTimestamp - input\.windowTelemetry\.windowStartTimestamp/)
})

test('train mode uses shared heuristic challenge label for telemetry', () => {
  const game = gameSource()
  const gameRules = gameRulesSource()
  assert.match(gameRules, /const predictedLabel = await this\.predictChallengeLabelForMode\(latestTelemetry\)/)
  assert.match(gameRules, /function predictFlowClimbHeuristicChallengeLabel\(features\)/)
  assert.match(gameRules, /return predictFlowClimbHeuristicChallengeLabel\(features\)/)
  assert.doesNotMatch(game, /predictFlowClimbChallengeLabelForMode\(/)
  assert.doesNotMatch(game, /predictFlowClimbLogisticRegressionChallengeLabel/)
  assert.doesNotMatch(gameRules, /predictFlowClimbLogisticRegressionChallengeLabel/)
  assert.match(telemetryWindowSource(), /challenge_label: input\.predictedLabel/)
})

test('10-second window collects telemetry, sends it, then adjusts difficulty', () => {
  const game = gameSource()
  const body = gameRulesSource().match(/  async updateDifficultyFromElapsedTime\(\) \{([\s\S]*?)\n  \},\n\n  async predictChallengeLabelForMode/)?.[1]
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
  const gameTelemetry = gameTelemetrySource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(gameTelemetry, /deploymentContext: this\.currentDeploymentContext\(\)/)
  assert.match(gameTelemetry, /currentDeploymentContext\(\)/)
  assert.match(gameTelemetry, /hostname === "\[::\]"/)
  assert.match(gameTelemetry, /hostname === "0\.0\.0\.0"/)
  assert.match(gameTelemetry, /hostname\.startsWith\("192\.168\."\)/)
  assert.match(gameTelemetry, /return isLocal \? "local" : "deployed"/)
  assert.match(telemetryWindow, /deployment_context: input\.deploymentContext/)
})

test('device type is tracked as a top-level mobile or desktop column', () => {
  const gameTelemetry = gameTelemetrySource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(gameTelemetry, /deviceType: this\.currentDeviceType\(\)/)
  assert.match(telemetryWindow, /device_type: input\.deviceType/)
  assert.match(gameTelemetry, /currentDeviceType\(\)/)
  assert.match(gameTelemetry, /return \(coarsePointer \|\| \(touchCapable && narrowViewport\)\) \? "mobile" : "desktop"/)
  assert.doesNotMatch(telemetryWindow, /screen_orientation:/)
})

test('skipped platforms are rewarded and tracked without missed-platform penalties', () => {
  const game = gameSource()
  const telemetryWindow = telemetryWindowSource()
  assert.doesNotMatch(game, /MISSED_FLAG_PENALTY/)
  assert.match(gameRulesSource(), /const SKIPPED_PLATFORM_REWARD = 2/)
  const platforms = platformsSource()
  assert.match(platforms, /this\.skipReward \+= reward/)
  assert.match(platforms, /this\.incrementWindowCounter\("skippedPlatforms", skippedCount\)/)
  assert.match(platforms, /this\.incrementWindowCounter\("skipReward", reward\)/)
  assert.match(runStateSource(), /this\.score = this\.flagsCollected \+ this\.skipReward - this\.deathPenalty/)
  assert.match(telemetryWindow, /skipped_platforms: input\.windowTelemetry\.skippedPlatforms/)
  assert.match(platforms, /showScoreIndicator\(`\+\$\{reward\} skip`/)
})

test('failed jumps are tracked by specific jump key', () => {
  const game = gameSource()
  const gameTelemetry = gameTelemetrySource()
  const telemetryWindow = telemetryWindowSource()
  assert.match(gameTelemetry, /failedJumpAttempts: 0/)
  assert.match(gameTelemetry, /failedJumpCountsByJump: \{\}/)
  assert.match(game, /recordFailedJumpAttempt\(\)/)
  assert.match(runStateSource(), /const jumpKey = `\$\{fromId\}->\$\{toId\}`/)
  assert.match(telemetryWindow, /repeated_failed_jump_attempts: repeatedFailedJumpAttempts/)
  assert.match(telemetryWindow, /distinct_failed_jumps: Object\.keys\(failedJumpCounts\)\.length/)
})

test('telemetry window shows a subtle short upload indicator', () => {
  const game = gameSource()
  const ui = uiSource()
  assert.match(game, /this\.uploadIcon = this\.add\.text\(14, SCREEN_HEIGHT - 28, "↥"/)
  assert.match(gameTelemetrySource(), /this\.flashUploadIcon\(\)\n    this\.logTelemetry\("telemetry_window"/)
  assert.match(ui, /this\.time\.delayedCall\(100/)
})

test('menu modes and model display behavior are wired', () => {
  const game = gameSource()
  const constants = constantsSource()
  const ui = uiSource()
  const rendering = renderingSource()
  assert.match(ui, /makeButton\(390, "Train mode", FLOWCLIMB_MODES\.TRAIN\)/)
  assert.match(ui, /makeButton\(470, "Flow mode — coming soon", FLOWCLIMB_MODES\.FLOW, \{ enabled: false \}\)/)
  assert.match(ui, /if \(visible && button\.menuEnabled\)/)
  assert.match(gameRulesSource(), /FLOW_MODEL_NAMES = \[/)
  assert.match(runStateSource(), /this\.selectedFlowModel = mode === FLOWCLIMB_MODES\.FLOW \? Phaser\.Utils\.Array\.GetRandom\(FLOW_MODEL_NAMES\) : null/)
  assert.match(constants, /PROMOTED_ONNX: "promoted_onnx"/)
  assert.match(runStateSource(), /this\.modelText\.setVisible\(this\.gameMode === FLOWCLIMB_MODES\.FLOW\)/)
  assert.match(rendering, /Flow model: \$\{this\.flowModelDisplayName\(\)\}/)
  assert.match(ui, /promoted_model_name/)
  assert.match(ui, /Flow: adaptive difficulty is coming soon\./)
  assert.match(ui, /showTrainModeIntro\(\)/)
  assert.match(ui, /Train mode collects gameplay data for the FlowClimb experiment\./)
  assert.match(ui, /The run will get more difficult over time\./)
  assert.match(ui, /Start train run/)
  assert.match(game, /this\.screenState === "menu" \|\| this\.screenState === "mode_intro"/)
  assert.match(gameTelemetrySource(), /FLOWCLIMB_GAME_MODE_LABELS\.FLOW_ML/)
})

test('session id resets on run restart and menu return', () => {
  assert.match(gameTelemetrySource(), /resetSessionId\(\) \{\n    this\.sessionId = this\.generateSessionId\(\)/)
  assert.match(gameTelemetrySource(), /this\.telemetry\.sessionId = this\.sessionId/)
  assert.match(runStateSource(), /startRun\(mode\) \{\n    this\.resetSessionId\(\)/)
  assert.match(uiSource(), /showMenu\(\) \{\n    this\.resetSessionId\(\)/)
})

test('access rejection clears stored participant token before blocking', () => {
  assert.match(gameTelemetrySource(), /if \(!accepted \|\| this\.accessBlocked\) \{\n        if \(!this\.accessBlocked\) \{\n          this\.clearStoredParticipantToken\(\)\n          this\.blockAccess\("Access token rejected", "Refresh and enter a valid access token\."\)/)
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
  assert.match(gameRulesSource(), /const onnxLabel = await this\.flowOnnxModel\.predict\(features\)/)
  assert.match(gameRulesSource(), /ONNX models cannot load from file:\/\//)
  assert.match(gameRulesSource(), /this\.blockAccess\("Flow model failed to load", hint\)/)
  assert.match(gameRulesSource(), /this\.blockAccess\("Flow model prediction failed", "Please notify the developer and include this message\."\)/)
  assert.doesNotMatch(game, /falling back to JS model/)
  assert.ok(fs.existsSync('src/models/flow/active.onnx'))
  assert.ok(fs.existsSync('src/models/flow/active.metadata.json'))
  const manifest = JSON.parse(fs.readFileSync('src/models/flow/manifest.json', 'utf8'))
  assert.equal(manifest.active_model, 'gaussian_nb')
})

test('removed sudden death UI wording', () => {
  assert.doesNotMatch(gameSource(), /sudden death/i)
})
