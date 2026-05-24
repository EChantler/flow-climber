const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const gameSource = () => fs.readFileSync('game.js', 'utf8')
const indexSource = () => fs.readFileSync('index.html', 'utf8')

test('browser scripts are syntactically valid JavaScript', () => {
  for (const file of ['game.js', 'telemetry.js', 'spawn-worker.js']) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  }
})

test('game version matches index cache-busting query params and package version', () => {
  const game = gameSource()
  const index = indexSource()
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const version = game.match(/const GAME_VERSION = "([^"]+)"/)?.[1]
  assert.ok(version, 'GAME_VERSION should be declared')
  const cacheVersion = version.replace(/^v/, '')
  assert.match(index, new RegExp(`telemetry\\.js\\?v=${cacheVersion}`))
  assert.match(index, new RegExp(`game\\.js\\?v=${cacheVersion}`))
  assert.equal(packageJson.version, cacheVersion)
})

test('only 10-second telemetry window events are logged from gameplay', () => {
  const game = gameSource()
  const eventTypes = [...game.matchAll(/this\.logTelemetry\("([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(eventTypes, ['telemetry_window'])
  assert.match(game, /const DIFFICULTY_UPDATE_INTERVAL_MS = 10000/)
  assert.match(game, /windowEndTimestamp = this\.lastTelemetryWindowTimestamp \+ DIFFICULTY_UPDATE_INTERVAL_MS/)
  assert.match(game, /window_duration_ms: now - this\.windowTelemetry\.windowStartTimestamp/)
})

test('10-second window collects telemetry, sends it, then adjusts difficulty', () => {
  const game = gameSource()
  const body = game.match(/  updateDifficultyFromElapsedTime\(\) \{([\s\S]*?)\n  \}\n\n  logTelemetryWindow/)?.[1]
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
  const game = gameSource()
  const requiredFields = [
    'window_index',
    'vertical_position_y',
    'jumps_landed_on_new_platforms',
    'new_platforms_reached',
    'deaths',
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
    'score',
  ]

  for (const field of requiredFields) {
    assert.match(game, new RegExp(`${field}:`), `missing telemetry field ${field}`)
  }
})

test('menu modes and model display behavior are wired', () => {
  const game = gameSource()
  assert.match(game, /makeButton\(390, "Train mode", "train"\)/)
  assert.match(game, /makeButton\(470, "Flow mode", "flow"\)/)
  assert.match(game, /FLOW_MODEL_NAMES = \["heuristic", "edge_logistic_regression"\]/)
  assert.match(game, /this\.modelText\.setVisible\(this\.gameMode === "flow"\)/)
  assert.match(game, /return this\.selectedFlowModel === "edge_logistic_regression" \? "flow-ML" : "flow-heuristic"/)
})

test('removed sudden death UI wording', () => {
  assert.doesNotMatch(gameSource(), /sudden death/i)
})
