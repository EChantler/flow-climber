const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadGameHelpers() {
  const context = { globalThis: {}, Math }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync('src/flow-constants.js', 'utf8'), context, { filename: 'src/flow-constants.js' })
  vm.runInNewContext(fs.readFileSync('src/game-rules.js', 'utf8'), context, { filename: 'src/game-rules.js' })
  return context
}

function baseFeatures(overrides = {}) {
  return {
    flagsDelta: 1,
    deathsDelta: 0,
    heightDelta: 100,
    intervalFlagsPerMinute: 6,
    intervalDeathsPerMinute: 0,
    secondsSinceFlag: 5,
    difficulty: 5,
    ...overrides,
  }
}

test('heuristic model classifies over, under, and appropriate challenge labels', () => {
  const models = loadGameHelpers()
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures({ deathsDelta: 2 })),
    models.FLOWCLIMB_CHALLENGE_LABELS.OVER,
  )
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures({ deathsDelta: 0, heightDelta: 800 })),
    models.FLOWCLIMB_CHALLENGE_LABELS.UNDER,
  )
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures()),
    models.FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE,
  )
})
