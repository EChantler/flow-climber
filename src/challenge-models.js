function predictFlowClimbHeuristicChallengeLabel(features) {
  const labels = globalThis.FLOWCLIMB_CHALLENGE_LABELS
  const lowUpwardProgress = features.heightDelta < 80
  const noObjectiveProgress = features.flagsDelta === 0

  if (features.deathsDelta >= 2 || (features.deathsDelta >= 1 && lowUpwardProgress) || (noObjectiveProgress && features.heightDelta < 40)) {
    return labels.OVER
  }
  if (features.flagsDelta >= 2 && features.deathsDelta === 0 && features.heightDelta >= 140) {
    return labels.UNDER
  }
  return labels.APPROPRIATE
}

function predictFlowClimbLogisticRegressionChallengeLabel(features, difficultyMax) {
  const labels = globalThis.FLOWCLIMB_CHALLENGE_LABELS
  const x = {
    flagsDelta: features.flagsDelta,
    deathsDelta: features.deathsDelta,
    intervalFlagsPerMinute: features.intervalFlagsPerMinute,
    intervalDeathsPerMinute: features.intervalDeathsPerMinute,
    secondsSinceFlag: features.secondsSinceFlag / 30,
    difficulty: features.difficulty / difficultyMax,
  }
  const scores = {
    [labels.UNDER]:
      -1.1 + (1.35 * x.flagsDelta) - (1.7 * x.deathsDelta) + (0.18 * x.intervalFlagsPerMinute) - (0.7 * x.intervalDeathsPerMinute) - (0.8 * x.secondsSinceFlag) - (0.2 * x.difficulty),
    [labels.OVER]:
      -1.0 - (0.7 * x.flagsDelta) + (1.6 * x.deathsDelta) - (0.12 * x.intervalFlagsPerMinute) + (0.9 * x.intervalDeathsPerMinute) + (1.25 * x.secondsSinceFlag) + (0.15 * x.difficulty),
    [labels.APPROPRIATE]:
      0.4 - (0.15 * Math.abs(x.flagsDelta - 1)) - (0.6 * x.deathsDelta) - (0.25 * Math.max(0, x.secondsSinceFlag - 0.75)),
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
}

function predictFlowClimbChallengeLabelForMode(features, options = {}) {
  const modes = globalThis.FLOWCLIMB_MODES
  const models = globalThis.FLOWCLIMB_FLOW_MODELS

  if (options.gameMode !== modes.FLOW) {
    return predictFlowClimbHeuristicChallengeLabel(features)
  }

  if (options.selectedFlowModel === models.EDGE_LOGISTIC_REGRESSION) {
    return predictFlowClimbLogisticRegressionChallengeLabel(features, options.difficultyMax)
  }

  return predictFlowClimbHeuristicChallengeLabel(features)
}

globalThis.predictFlowClimbHeuristicChallengeLabel = predictFlowClimbHeuristicChallengeLabel
globalThis.predictFlowClimbLogisticRegressionChallengeLabel = predictFlowClimbLogisticRegressionChallengeLabel
globalThis.predictFlowClimbChallengeLabelForMode = predictFlowClimbChallengeLabelForMode
