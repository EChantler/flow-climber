function between(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function intervalOverlaps(minA, maxA, minB, maxB) {
  return !(maxA < minB || minA > maxB)
}

function difficultyRatio(level, config) {
  return (level - config.difficultyMin) / (config.difficultyMax - config.difficultyMin)
}

function scaleValue(easy, hard, level, config) {
  return easy + (hard - easy) * difficultyRatio(level, config)
}

function clampDifficulty(level, config) {
  return Math.max(config.difficultyMin, Math.min(config.difficultyMax, level))
}

function currentSpawnParams(level, config) {
  const effectiveLevel = clampDifficulty(level, config)
  const scaledMinGapY = Math.round(scaleValue(config.platformMinGapYEasy, config.platformMinGapYHard, effectiveLevel, config))
  const scaledMaxGapY = Math.round(scaleValue(config.platformMaxGapYEasy, config.platformMaxGapYHard, effectiveLevel, config))
  const minGapY = Math.max(config.minPlatformGapY, scaledMinGapY)
  const maxGapY = Math.max(minGapY, scaledMaxGapY)

  return {
    minWidth: Math.round(scaleValue(config.platformMinWidthEasy, config.platformMinWidthHard, effectiveLevel, config)),
    maxWidth: Math.round(scaleValue(config.platformMaxWidthEasy, config.platformMaxWidthHard, effectiveLevel, config)),
    minHeight: Math.round(scaleValue(config.platformMinHeightEasy, config.platformMinHeightHard, effectiveLevel, config)),
    maxHeight: Math.round(scaleValue(config.platformMaxHeightEasy, config.platformMaxHeightHard, effectiveLevel, config)),
    minGapY,
    maxGapY,
    minXShift: Math.round(scaleValue(config.platformMinXShiftEasy, config.platformMinXShiftHard, effectiveLevel, config)),
    maxXShift: Math.round(scaleValue(config.platformMaxXShiftEasy, config.platformMaxXShiftHard, effectiveLevel, config)),
  }
}

function randomPlatformDimensions(params, nextIsWide, config) {
  const minWidth = nextIsWide ? config.widePlatformMinWidth : params.minWidth
  const maxWidth = nextIsWide ? config.widePlatformMaxWidth : params.maxWidth
  return [
    between(minWidth, maxWidth),
    between(params.minHeight, params.maxHeight),
  ]
}

function isHorizontallyAway(fromPlatform, nextX, nextWidth, config) {
  const nextRight = nextX + nextWidth
  const fromRight = fromPlatform.x + fromPlatform.width
  const isRightOfCurrent = nextX >= fromRight + config.platformHorizontalClearance
  const isLeftOfCurrent = nextRight <= fromPlatform.x - config.platformHorizontalClearance
  return isRightOfCurrent || isLeftOfCurrent
}

function descendingLandingFrame(gapY, gameSpeed, config) {
  const targetY = -gapY
  let yBottom = 0
  let velocityY = config.jumpVelocity

  for (let frame = 1; frame <= 240; frame += 1) {
    const previousBottom = yBottom
    if (velocityY < 0) {
      velocityY += config.gravityRise * gameSpeed
    } else {
      velocityY += config.gravityFall * gameSpeed
    }
    velocityY = Math.min(velocityY, config.maxFallSpeed)
    yBottom += velocityY * gameSpeed

    if (velocityY > 0 && previousBottom <= targetY && targetY <= yBottom) {
      return frame
    }
  }

  return null
}

function descentLandingWindow(fromPlatform, gapY, difficultyLevel, config) {
  const landingFrame = descendingLandingFrame(gapY, 1, config)
  if (landingFrame === null) {
    return null
  }

  const travel = config.playerSpeedMax * landingFrame
  const startLeftMin = fromPlatform.x
  const startLeftMax = fromPlatform.x + fromPlatform.width - config.playerWidth
  const possibleLeftMin = Math.max(0, startLeftMin - travel)
  const possibleLeftMax = Math.min(config.screenWidth - config.playerWidth, startLeftMax + travel)
  return { possibleLeftMin, possibleLeftMax }
}

function centerDepartureRange(fromPlatform, config) {
  const minLeft = fromPlatform.x
  const maxLeft = fromPlatform.x + fromPlatform.width - config.playerWidth
  const centerLeft = fromPlatform.x + fromPlatform.width / 2 - config.playerWidth / 2
  const rangeMin = clamp(centerLeft - config.centerDepartureHalfWidth, minLeft, maxLeft)
  const rangeMax = clamp(centerLeft + config.centerDepartureHalfWidth, minLeft, maxLeft)
  return {
    min: Math.min(rangeMin, rangeMax),
    max: Math.max(rangeMin, rangeMax),
  }
}

function generateNextPlatform(fromPlatform, difficultyLevel, config) {
  const params = currentSpawnParams(difficultyLevel, config)
  const nextIsWide = !fromPlatform.isWide && Math.random() < config.widePlatformChance
  const requireRunUp = Math.random() < config.runUpRequiredChance
  const centerRange = centerDepartureRange(fromPlatform, config)
  const fromLeftMin = fromPlatform.x
  const fromLeftMax = fromPlatform.x + fromPlatform.width - config.playerWidth

  const isCandidateValid = (nextX, width, gapY) => {
    if (!isHorizontallyAway(fromPlatform, nextX, width, config)) {
      return false
    }

    const descent = descentLandingWindow(fromPlatform, gapY, difficultyLevel, config)
    if (descent === null) {
      return false
    }

    const requiredLeftMin = nextX - config.playerWidth + 1
    const requiredLeftMax = nextX + width - 1
    const reachable = intervalOverlaps(
      descent.possibleLeftMin,
      descent.possibleLeftMax,
      requiredLeftMin,
      requiredLeftMax,
    )
    if (!reachable) {
      return false
    }

    const canUndershoot = descent.possibleLeftMin < requiredLeftMin - config.overshootMargin
    const canOvershoot = descent.possibleLeftMax > requiredLeftMax + config.overshootMargin
    if (!canUndershoot && !canOvershoot) {
      return false
    }

    if (!requireRunUp) {
      return true
    }

    const travelLeft = centerRange.min - fromLeftMin
    const travelRight = fromLeftMax - centerRange.max
    const centerPossibleMin = Math.max(descent.possibleLeftMin, descent.possibleLeftMin + travelLeft)
    const centerPossibleMax = Math.min(descent.possibleLeftMax, descent.possibleLeftMax - travelRight)
    const centerReachable = intervalOverlaps(centerPossibleMin, centerPossibleMax, requiredLeftMin, requiredLeftMax)
    return !centerReachable
  }

  for (let i = 0; i < config.spawnRandomAttempts; i += 1) {
    const dimensions = randomPlatformDimensions(params, nextIsWide, config)
    const width = dimensions[0]
    const height = dimensions[1]
    const gapY = between(params.minGapY, params.maxGapY)
    const nextY = fromPlatform.y - gapY

    let xShift = between(params.minXShift, params.maxXShift)
    xShift *= between(0, 1) === 0 ? -1 : 1
    let nextX = fromPlatform.x + xShift
    nextX = clamp(nextX, 0, config.screenWidth - width)

    if (Math.abs(nextX - fromPlatform.x) < params.minXShift) {
      continue
    }

    if (isCandidateValid(nextX, width, gapY)) {
      return {
        x: nextX,
        y: nextY,
        width,
        height,
        isWide: nextIsWide,
        flagCollected: false,
      }
    }
  }

  const shiftSteps = [
    params.minXShift,
    Math.max(60, Math.floor(params.minXShift * 0.75)),
    Math.max(30, Math.floor(params.minXShift * 0.5)),
  ]
  const gapSteps = [
    params.minGapY,
    Math.max(config.minPlatformGapY, Math.floor(params.minGapY * 0.75)),
    config.minPlatformGapY,
  ]

  for (const gapY of gapSteps) {
    for (const shift of shiftSteps) {
      for (const direction of [-1, 1]) {
        const width = nextIsWide
          ? Math.floor((config.widePlatformMinWidth + config.widePlatformMaxWidth) / 2)
          : Math.max(params.minWidth, Math.floor((params.minWidth + params.maxWidth) / 2))
        const height = Math.max(params.minHeight, Math.floor((params.minHeight + params.maxHeight) / 2))
        let nextX = fromPlatform.x + direction * shift
        nextX = clamp(nextX, 0, config.screenWidth - width)
        const nextY = fromPlatform.y - gapY
        if (isCandidateValid(nextX, width, gapY)) {
          return {
            x: nextX,
            y: nextY,
            width,
            height,
            isWide: nextIsWide,
            flagCollected: false,
          }
        }
      }
    }
  }

  const safeWidth = nextIsWide
    ? Math.floor((config.widePlatformMinWidth + config.widePlatformMaxWidth) / 2)
    : Math.max(params.minWidth, Math.floor((params.minWidth + params.maxWidth) / 2))
  const safeHeight = Math.max(params.minHeight, Math.floor((params.minHeight + params.maxHeight) / 2))
  const safeGapY = config.minPlatformGapY
  const leftSafeX = fromPlatform.x - config.platformHorizontalClearance - safeWidth
  const rightSafeX = fromPlatform.x + fromPlatform.width + config.platformHorizontalClearance
  const canPlaceLeft = leftSafeX >= 0
  const canPlaceRight = rightSafeX <= config.screenWidth - safeWidth

  let safeX
  if (canPlaceLeft && canPlaceRight) {
    safeX = between(0, 1) === 0 ? leftSafeX : rightSafeX
  } else if (canPlaceRight) {
    safeX = rightSafeX
  } else if (canPlaceLeft) {
    safeX = leftSafeX
  } else {
    safeX = clamp(fromPlatform.x + fromPlatform.width + config.platformHorizontalClearance, 0, config.screenWidth - safeWidth)
  }

  return {
    x: safeX,
    y: fromPlatform.y - safeGapY,
    width: safeWidth,
    height: safeHeight,
    isWide: nextIsWide,
    flagCollected: false,
  }
}

self.onmessage = (event) => {
  const payload = event.data
  if (!payload || payload.type !== "generate") {
    return
  }

  const platform = generateNextPlatform(payload.fromPlatform, payload.difficultyLevel, payload.config)
  self.postMessage({
    type: "generated",
    requestId: payload.requestId,
    key: payload.key,
    platform,
  })
}
