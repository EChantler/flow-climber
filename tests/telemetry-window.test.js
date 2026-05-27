const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadTelemetryWindow() {
  const context = { globalThis: {} }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync('src/game-telemetry.js', 'utf8'), context, { filename: 'src/game-telemetry.js' })
  return context
}

test('telemetry window payload helper computes repeated failed jump metrics', () => {
  const { buildFlowClimbTelemetryWindowPayload } = loadTelemetryWindow()
  const payload = buildFlowClimbTelemetryWindowPayload({
    telemetrySchemaVersion: 5,
    telemetryWindowIndex: 3,
    windowEndTimestamp: 110000,
    windowTelemetry: {
      windowStartTimestamp: 100000,
      windowStartingHeight: 12,
      jumpLandingsOnNewPlatforms: 1,
      newPlatformsReached: 2,
      deaths: 1,
      skippedPlatforms: 2,
      skipReward: 4,
      failedJumpAttempts: 3,
      failedJumpCountsByJump: { '1->2': 2, '2->3': 1 },
      horizontalMovement: 42.7,
      leftKeyPresses: 1,
      rightKeyPresses: 2,
      jumpKeyPresses: 3,
    },
    gameModeLabel: 'train',
    deploymentContext: 'deployed',
    deviceType: 'desktop',
    player: { y: 99.8 },
    heightClimbed: 120,
    score: 7,
    difficultyLevel: 4,
    previousDifficulty: 3,
    predictedLabel: 'appropriately_challenged',
    skipReward: 10,
    spawnParams: {
      minWidth: 30,
      maxWidth: 80,
      minHeight: 10,
      maxHeight: 10,
      minGapY: 100,
      maxGapY: 140,
      minXShift: 130,
      maxXShift: 220,
    },
    platformSpeed: 0.6789,
    flagsCollected: 5,
    deathCount: 2,
    latestTelemetry: { secondsSinceFlag: 1.2345 },
  })

  assert.equal(payload.window_duration_ms, 10000)
  assert.equal(payload.deployment_context, 'deployed')
  assert.equal(payload.distinct_failed_jumps, 2)
  assert.equal(payload.repeated_failed_jump_attempts, 1)
  assert.deepEqual(payload.failed_jump_counts, { '1->2': 2, '2->3': 1 })
  assert.equal(payload.total_horizontal_movement_px, 43)
  assert.equal(payload.platform_speed_px_per_frame, 0.679)
})
