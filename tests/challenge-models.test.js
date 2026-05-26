const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadGameHelpers() {
  const game = fs.readFileSync('src/game.js', 'utf8')
  const helperSource = game.match(/function predictFlowClimbHeuristicChallengeLabel[\s\S]*?\n}\n\nconst BACKGROUND_HEIGHT_STOPS/)?.[0]
    ?.replace(/\n\nconst BACKGROUND_HEIGHT_STOPS$/, '')
  assert.ok(helperSource, 'heuristic helper should be found in game.js')

  const context = { globalThis: {} }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync('src/flow-constants.js', 'utf8'), context, { filename: 'src/flow-constants.js' })
  vm.runInNewContext(helperSource, context, { filename: 'src/game.js#heuristic-helper' })
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
