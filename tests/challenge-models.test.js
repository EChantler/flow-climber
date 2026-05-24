const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadChallengeModels() {
  const context = { globalThis: {} }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync('src/flow-constants.js', 'utf8'), context, { filename: 'src/flow-constants.js' })
  vm.runInNewContext(fs.readFileSync('src/challenge-models.js', 'utf8'), context, { filename: 'src/challenge-models.js' })
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
  const models = loadChallengeModels()
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures({ deathsDelta: 2 })),
    models.FLOWCLIMB_CHALLENGE_LABELS.OVER,
  )
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures({ flagsDelta: 2, heightDelta: 160 })),
    models.FLOWCLIMB_CHALLENGE_LABELS.UNDER,
  )
  assert.equal(
    models.predictFlowClimbHeuristicChallengeLabel(baseFeatures()),
    models.FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE,
  )
})

test('train mode uses heuristic model through shared challenge prediction entry point', () => {
  const models = loadChallengeModels()
  const label = models.predictFlowClimbChallengeLabelForMode(baseFeatures({ deathsDelta: 2 }), {
    gameMode: models.FLOWCLIMB_MODES.TRAIN,
    selectedFlowModel: models.FLOWCLIMB_FLOW_MODELS.EDGE_LOGISTIC_REGRESSION,
    difficultyMax: 10,
  })
  assert.equal(label, models.FLOWCLIMB_CHALLENGE_LABELS.OVER)
})
