const FLOWCLIMB_PLATFORM_METHODS = {
  assignPlatformId(platform) {
    if (platform.id === undefined || platform.id === null) {
      platform.id = this.nextPlatformId
      this.nextPlatformId += 1
    }
    return platform
  },

  initializeSpawnWorker() {
    if (typeof Worker === "undefined") {
      return
    }
  
    try {
      this.spawnWorker = new Worker(`./src/spawn-worker.js?v=${GAME_VERSION}`)
      this.spawnWorker.onmessage = (event) => {
        const payload = event.data
        if (!payload || payload.type !== "generated") {
          return
        }
  
        if (payload.requestId !== this.latestSpawnRequestId) {
          return
        }
  
        this.spawnPrefetch = {
          key: payload.key,
          platform: payload.platform,
        }
      }
      this.spawnWorker.onerror = () => {
        this.spawnWorker = null
        this.spawnPrefetch = null
      }
    } catch (_) {
      this.spawnWorker = null
    }
  },

  spawnPrefetchKey(fromPlatform, difficultyLevel) {
    const wideMarker = fromPlatform.isWide ? 1 : 0
    return `${difficultyLevel}|${fromPlatform.x}|${fromPlatform.y}|${fromPlatform.width}|${fromPlatform.height}|${wideMarker}`
  },

  spawnConfigPayload() {
    return {
      screenWidth: SCREEN_WIDTH,
      playerWidth: PLAYER_WIDTH,
      playerHeight: PLAYER_HEIGHT,
      gravityRise: GRAVITY_RISE,
      gravityFall: GRAVITY_FALL,
      jumpVelocity: JUMP_VELOCITY,
      maxFallSpeed: MAX_FALL_SPEED,
      playerSpeedMax: PLAYER_RUN_SPEED,
      overshootMargin: OVERSHOOT_MARGIN,
      difficultyMin: DIFFICULTY_MIN,
      difficultyMax: DIFFICULTY_MAX,
      platformMinWidthEasy: PLATFORM_MIN_WIDTH_EASY,
      platformMaxWidthEasy: PLATFORM_MAX_WIDTH_EASY,
      platformMinWidthHard: PLATFORM_MIN_WIDTH_HARD,
      platformMaxWidthHard: PLATFORM_MAX_WIDTH_HARD,
      platformMinHeightEasy: PLATFORM_MIN_HEIGHT_EASY,
      platformMaxHeightEasy: PLATFORM_MAX_HEIGHT_EASY,
      platformMinHeightHard: PLATFORM_MIN_HEIGHT_HARD,
      platformMaxHeightHard: PLATFORM_MAX_HEIGHT_HARD,
      platformMinGapYEasy: PLATFORM_MIN_GAP_Y_EASY,
      platformMinGapYHard: PLATFORM_MIN_GAP_Y_HARD,
      platformMaxGapYEasy: PLATFORM_MAX_GAP_Y_EASY,
      platformMaxGapYHard: PLATFORM_MAX_GAP_Y_HARD,
      platformMinXShiftEasy: PLATFORM_MIN_X_SHIFT_EASY,
      platformMinXShiftHard: PLATFORM_MIN_X_SHIFT_HARD,
      platformMaxXShiftEasy: PLATFORM_MAX_X_SHIFT_EASY,
      platformMaxXShiftHard: PLATFORM_MAX_X_SHIFT_HARD,
      widePlatformMinWidth: WIDE_PLATFORM_MIN_WIDTH,
      widePlatformMaxWidth: WIDE_PLATFORM_MAX_WIDTH,
      widePlatformChance: WIDE_PLATFORM_CHANCE,
      platformHorizontalClearance: PLATFORM_HORIZONTAL_CLEARANCE,
      runUpRequiredChance: RUN_UP_REQUIRED_CHANCE,
      centerDepartureHalfWidth: CENTER_DEPARTURE_HALF_WIDTH,
      minPlatformGapY: MIN_PLATFORM_GAP_Y,
      spawnRandomAttempts: SPAWN_RANDOM_ATTEMPTS,
    }
  },

  queueSpawnPrefetch(fromPlatform, difficultyLevel) {
    if (!this.spawnWorker) {
      return
    }
  
    this.latestSpawnRequestId += 1
    const requestId = this.latestSpawnRequestId
    const key = this.spawnPrefetchKey(fromPlatform, difficultyLevel)
  
    this.spawnWorker.postMessage({
      type: "generate",
      requestId,
      key,
      fromPlatform: {
        x: fromPlatform.x,
        y: fromPlatform.y,
        width: fromPlatform.width,
        height: fromPlatform.height,
        isWide: !!fromPlatform.isWide,
      },
      difficultyLevel,
      config: this.spawnConfigPayload(),
    })
  },

  getNextPlatform(fromPlatform, difficultyLevel) {
    const key = this.spawnPrefetchKey(fromPlatform, difficultyLevel)
    if (this.spawnPrefetch && this.spawnPrefetch.key === key) {
      const cached = this.spawnPrefetch.platform
      this.spawnPrefetch = null
      return this.decoratePlatform(this.assignPlatformId({
        x: cached.x,
        y: cached.y,
        width: cached.width,
        height: cached.height,
        isWide: !!cached.isWide,
        flagCollected: false,
        flagVisible: false,
      }), difficultyLevel)
    }
  
    return this.decoratePlatform(this.assignPlatformId(this.spawnNextPlatformForLevel(fromPlatform, difficultyLevel)), difficultyLevel)
  },

  ensurePlatformBuffer(difficultyLevel) {
    while (this.platforms.length < PLATFORM_WINDOW_SIZE) {
      const fromPlatform = this.platforms[this.platforms.length - 1]
      const spawnedPlatform = this.getNextPlatform(fromPlatform, difficultyLevel)
      this.platforms.push(spawnedPlatform)
    }
  
    while (this.platforms.length > PLATFORM_WINDOW_SIZE) {
      const removed = this.platforms.shift()
      this.objectivePlatformIndex = Math.max(0, this.objectivePlatformIndex - 1)
      if (this.lastSafePlatform === removed) {
        this.lastSafePlatform = this.platforms[0] || removed
      }
      if (this.groundPlatform === removed) {
        this.groundPlatform = this.platforms[0] || removed
      }
    }
  
    this.syncCollectibleFlags()
  },

  syncCollectibleFlags() {
    for (let i = 0; i < this.platforms.length; i += 1) {
      const platform = this.platforms[i]
      platform.flagVisible = i === this.objectivePlatformIndex && !platform.flagCollected
    }
  },

  retireResolvedPlatforms() {
    while (this.objectivePlatformIndex > PLATFORMS_BEHIND_TO_KEEP && this.platforms.length > 0) {
      const removed = this.platforms.shift()
      this.objectivePlatformIndex -= 1
      if (this.lastSafePlatform === removed) {
        this.lastSafePlatform = this.platforms[0] || removed
      }
      if (this.groundPlatform === removed) {
        this.groundPlatform = this.platforms[0] || removed
      }
    }
  
    while (this.platforms.length > PLATFORM_WINDOW_SIZE) {
      const removed = this.platforms.shift()
      if (this.lastSafePlatform === removed) {
        this.lastSafePlatform = this.platforms[0] || removed
      }
      if (this.groundPlatform === removed) {
        this.groundPlatform = this.platforms[0] || removed
      }
    }
  
    this.syncCollectibleFlags()
  },

  collectCurrentObjective(now) {
    const targetPlatform = this.platforms[this.objectivePlatformIndex]
    if (!targetPlatform || !targetPlatform.flagVisible) {
      return false
    }
  
    targetPlatform.flagCollected = true
    targetPlatform.flagVisible = false
    this.flagsCollected += 1
    this.lastFlagTimestamp = now
    this.deathTimestamps = []
    this.unstuckAvailable = false
    this.unstuckOverlay.setVisible(false)
    this.updateScore()
    this.flashHudText(this.flagsText)
    this.showScoreIndicator("+1", "#55f28f")
  
    this.objectivePlatformIndex += 1
    this.retireResolvedPlatforms()
    this.ensurePlatformBuffer(this.difficultyLevel)
    this.queueSpawnPrefetch(this.platforms[this.platforms.length - 1], this.difficultyLevel)
    return true
  },

  advanceAfterSkippedLanding(landedPlatformIndex, now) {
    if (landedPlatformIndex <= this.objectivePlatformIndex) {
      return false
    }
  
    const skippedCount = landedPlatformIndex - this.objectivePlatformIndex
    const reward = SKIPPED_PLATFORM_REWARD * skippedCount
    this.skipReward += reward
    this.incrementWindowCounter("skippedPlatforms", skippedCount)
    this.incrementWindowCounter("skipReward", reward)
    this.lastFlagTimestamp = now
    this.updateScore()
    this.showScoreIndicator(`+${reward} skip`, "#55d6ff")
  
    this.objectivePlatformIndex = Math.min(landedPlatformIndex + 1, this.platforms.length - 1)
    this.retireResolvedPlatforms()
    this.ensurePlatformBuffer(this.difficultyLevel)
    this.queueSpawnPrefetch(this.platforms[this.platforms.length - 1], this.difficultyLevel)
    return true
  },

  decoratePlatform(platform, difficultyLevel, canMove = true) {
    const decorated = {
      ...platform,
      moveDirection: 0,
      moveSpeedX: 0,
      moveMinX: platform.x,
      moveMaxX: platform.x,
    }
  
    const canActuallyMove = canMove && !platform.isWide && Math.random() < MOVING_PLATFORM_CHANCE
    if (!canActuallyMove) {
      return decorated
    }
  
    const travelRange = Phaser.Math.Between(MOVING_PLATFORM_RANGE_MIN, MOVING_PLATFORM_RANGE_MAX)
    decorated.moveMinX = Math.max(0, platform.x - travelRange)
    decorated.moveMaxX = Math.min(SCREEN_WIDTH - platform.width, platform.x + travelRange)
    if (decorated.moveMinX >= decorated.moveMaxX) {
      return decorated
    }
  
    decorated.moveDirection = Math.random() < 0.5 ? -1 : 1
    decorated.moveSpeedX = this.movingPlatformSpeedForDifficulty(difficultyLevel)
    return decorated
  },

  movingPlatformSpeedForDifficulty(difficultyLevel) {
    const ratio = Phaser.Math.Clamp(this.difficultyRatio(difficultyLevel), 0, 1)
    return Phaser.Math.Linear(MOVING_PLATFORM_SPEED_MIN, MOVING_PLATFORM_SPEED_MAX, ratio)
  },

  movePlatforms(frameScale) {
    for (const platform of this.platforms) {
      if (!platform.moveDirection || !platform.moveSpeedX) {
        continue
      }
  
      const previousX = platform.x
      platform.x += platform.moveDirection * platform.moveSpeedX * frameScale
  
      if (platform.x <= platform.moveMinX) {
        platform.x = platform.moveMinX
        platform.moveDirection = 1
      } else if (platform.x >= platform.moveMaxX) {
        platform.x = platform.moveMaxX
        platform.moveDirection = -1
      }
  
      const deltaX = platform.x - previousX
      if (platform === this.groundPlatform && this.player.onGround) {
        this.player.x = Phaser.Math.Clamp(this.player.x + deltaX, 0, SCREEN_WIDTH - this.player.width)
      }
    }
  },

  flagTriggerRect(platform) {
    return {
      x: platform.x + platform.width / 2 - 8,
      y: platform.y - 16,
      width: 16,
      height: 16,
    }
  },

  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    )
  },

  descendingLandingFrame(gapY, gameSpeed) {
    const targetY = -gapY
    let yBottom = 0
    let velocityY = JUMP_VELOCITY
  
    for (let frame = 1; frame <= 240; frame += 1) {
      const previousBottom = yBottom
      if (velocityY < 0) {
        velocityY += GRAVITY_RISE * gameSpeed
      } else {
        velocityY += GRAVITY_FALL * gameSpeed
      }
      velocityY = Math.min(velocityY, MAX_FALL_SPEED)
      yBottom += velocityY * gameSpeed
  
      if (velocityY > 0 && previousBottom <= targetY && targetY <= yBottom) {
        return frame
      }
    }
  
    return null
  },

  difficultyRatio(level) {
    return (level - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN)
  },

  scaleValue(easy, hard, level) {
    return easy + (hard - easy) * this.difficultyRatio(level)
  },

  currentSpawnParams(level) {
    const effectiveLevel = Phaser.Math.Clamp(level, DIFFICULTY_MIN, DIFFICULTY_MAX)
    const scaledMinGapY = Math.round(this.scaleValue(PLATFORM_MIN_GAP_Y_EASY, PLATFORM_MIN_GAP_Y_HARD, effectiveLevel))
    const scaledMaxGapY = Math.round(this.scaleValue(PLATFORM_MAX_GAP_Y_EASY, PLATFORM_MAX_GAP_Y_HARD, effectiveLevel))
    const minGapY = Math.max(MIN_PLATFORM_GAP_Y, scaledMinGapY)
    const maxGapY = Math.max(minGapY, scaledMaxGapY)
  
    return {
      minWidth: Math.round(this.scaleValue(PLATFORM_MIN_WIDTH_EASY, PLATFORM_MIN_WIDTH_HARD, effectiveLevel)),
      maxWidth: Math.round(this.scaleValue(PLATFORM_MAX_WIDTH_EASY, PLATFORM_MAX_WIDTH_HARD, effectiveLevel)),
      minHeight: Math.round(this.scaleValue(PLATFORM_MIN_HEIGHT_EASY, PLATFORM_MIN_HEIGHT_HARD, effectiveLevel)),
      maxHeight: Math.round(this.scaleValue(PLATFORM_MAX_HEIGHT_EASY, PLATFORM_MAX_HEIGHT_HARD, effectiveLevel)),
      minGapY,
      maxGapY,
      minXShift: Math.round(this.scaleValue(PLATFORM_MIN_X_SHIFT_EASY, PLATFORM_MIN_X_SHIFT_HARD, effectiveLevel)),
      maxXShift: Math.round(this.scaleValue(PLATFORM_MAX_X_SHIFT_EASY, PLATFORM_MAX_X_SHIFT_HARD, effectiveLevel)),
    }
  },

  randomPlatformDimensions(params, isWide) {
    const minWidth = isWide ? WIDE_PLATFORM_MIN_WIDTH : params.minWidth
    const maxWidth = isWide ? WIDE_PLATFORM_MAX_WIDTH : params.maxWidth
    return [
      Phaser.Math.Between(minWidth, maxWidth),
      Phaser.Math.Between(params.minHeight, params.maxHeight),
    ]
  },

  intervalOverlaps(minA, maxA, minB, maxB) {
    return !(maxA < minB || minA > maxB)
  },

  isHorizontallyAway(fromPlatform, nextX, nextWidth) {
    const nextRight = nextX + nextWidth
    const fromRight = fromPlatform.x + fromPlatform.width
    const isRightOfCurrent = nextX >= fromRight + PLATFORM_HORIZONTAL_CLEARANCE
    const isLeftOfCurrent = nextRight <= fromPlatform.x - PLATFORM_HORIZONTAL_CLEARANCE
    return isRightOfCurrent || isLeftOfCurrent
  },

  isReachableOnDescent(fromPlatform, nextX, nextWidth, gapY, difficultyLevel) {
    const descent = this.descentLandingWindow(fromPlatform, gapY, difficultyLevel)
    if (descent === null) {
      return false
    }
  
    const { possibleLeftMin, possibleLeftMax } = descent
    const requiredLeftMin = nextX - PLAYER_WIDTH + 1
    const requiredLeftMax = nextX + nextWidth - 1
  
    return !(possibleLeftMax < requiredLeftMin || possibleLeftMin > requiredLeftMax)
  },

  isOvershootPossibleOnDescent(fromPlatform, nextX, nextWidth, gapY, difficultyLevel) {
    const descent = this.descentLandingWindow(fromPlatform, gapY, difficultyLevel)
    if (descent === null) {
      return false
    }
  
    const { possibleLeftMin, possibleLeftMax } = descent
    const requiredLeftMin = nextX - PLAYER_WIDTH + 1
    const requiredLeftMax = nextX + nextWidth - 1
  
    const canUndershoot = possibleLeftMin < requiredLeftMin - OVERSHOOT_MARGIN
    const canOvershoot = possibleLeftMax > requiredLeftMax + OVERSHOOT_MARGIN
    return canUndershoot || canOvershoot
  },

  descentLandingWindow(fromPlatform, gapY, difficultyLevel) {
    const landingFrame = this.descendingLandingFrame(gapY, 1)
    if (landingFrame === null) {
      return null
    }
  
    const travel = PLAYER_RUN_SPEED * landingFrame
    const startLeftMin = fromPlatform.x
    const startLeftMax = fromPlatform.x + fromPlatform.width - PLAYER_WIDTH
    const possibleLeftMin = Math.max(0, startLeftMin - travel)
    const possibleLeftMax = Math.min(SCREEN_WIDTH - PLAYER_WIDTH, startLeftMax + travel)
  
    return { possibleLeftMin, possibleLeftMax }
  },

  centerDepartureRange(fromPlatform) {
    const minLeft = fromPlatform.x
    const maxLeft = fromPlatform.x + fromPlatform.width - PLAYER_WIDTH
    const centerLeft = fromPlatform.x + fromPlatform.width / 2 - PLAYER_WIDTH / 2
    const rangeMin = Phaser.Math.Clamp(centerLeft - CENTER_DEPARTURE_HALF_WIDTH, minLeft, maxLeft)
    const rangeMax = Phaser.Math.Clamp(centerLeft + CENTER_DEPARTURE_HALF_WIDTH, minLeft, maxLeft)
    return {
      min: Math.min(rangeMin, rangeMax),
      max: Math.max(rangeMin, rangeMax),
    }
  },

  spawnNextPlatformForLevel(fromPlatform, difficultyLevel) {
    const params = this.currentSpawnParams(difficultyLevel)
    const nextIsWide = !fromPlatform.isWide && Math.random() < WIDE_PLATFORM_CHANCE
    const requireRunUp = Math.random() < RUN_UP_REQUIRED_CHANCE
    const { min: centerMin, max: centerMax } = this.centerDepartureRange(fromPlatform)
    const fromLeftMin = fromPlatform.x
    const fromLeftMax = fromPlatform.x + fromPlatform.width - PLAYER_WIDTH
  
    const isCandidateValid = (nextX, width, gapY) => {
      const away = this.isHorizontallyAway(fromPlatform, nextX, width)
      if (!away) {
        return false
      }
  
      const descent = this.descentLandingWindow(fromPlatform, gapY, difficultyLevel)
      if (descent === null) {
        return false
      }
  
      const requiredLeftMin = nextX - PLAYER_WIDTH + 1
      const requiredLeftMax = nextX + width - 1
      const reachable = this.intervalOverlaps(
        descent.possibleLeftMin,
        descent.possibleLeftMax,
        requiredLeftMin,
        requiredLeftMax,
      )
      if (!reachable) {
        return false
      }
  
      const canUndershoot = descent.possibleLeftMin < requiredLeftMin - OVERSHOOT_MARGIN
      const canOvershoot = descent.possibleLeftMax > requiredLeftMax + OVERSHOOT_MARGIN
      if (!canUndershoot && !canOvershoot) {
        return false
      }
  
      if (!requireRunUp) {
        return true
      }
  
      const travelLeft = centerMin - fromLeftMin
      const travelRight = fromLeftMax - centerMax
      const centerPossibleMin = Math.max(descent.possibleLeftMin, descent.possibleLeftMin + travelLeft)
      const centerPossibleMax = Math.min(descent.possibleLeftMax, descent.possibleLeftMax - travelRight)
      const centerReachable = this.intervalOverlaps(centerPossibleMin, centerPossibleMax, requiredLeftMin, requiredLeftMax)
      return !centerReachable
    }
  
    for (let i = 0; i < SPAWN_RANDOM_ATTEMPTS; i += 1) {
      const [width, height] = this.randomPlatformDimensions(params, nextIsWide)
      const gapY = Phaser.Math.Between(params.minGapY, params.maxGapY)
      const nextY = fromPlatform.y - gapY
  
      let xShift = Phaser.Math.Between(params.minXShift, params.maxXShift)
      xShift *= Phaser.Math.Between(0, 1) === 0 ? -1 : 1
      let nextX = fromPlatform.x + xShift
      nextX = Phaser.Math.Clamp(nextX, 0, SCREEN_WIDTH - width)
  
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
      Math.max(MIN_PLATFORM_GAP_Y, Math.floor(params.minGapY * 0.75)),
      MIN_PLATFORM_GAP_Y,
    ]
    for (const gapY of gapSteps) {
      for (const shift of shiftSteps) {
        for (const direction of [-1, 1]) {
          const width = nextIsWide
            ? Math.floor((WIDE_PLATFORM_MIN_WIDTH + WIDE_PLATFORM_MAX_WIDTH) / 2)
            : Math.max(params.minWidth, Math.floor((params.minWidth + params.maxWidth) / 2))
          const height = Math.max(params.minHeight, Math.floor((params.minHeight + params.maxHeight) / 2))
          let nextX = fromPlatform.x + direction * shift
          nextX = Phaser.Math.Clamp(nextX, 0, SCREEN_WIDTH - width)
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
      ? Math.floor((WIDE_PLATFORM_MIN_WIDTH + WIDE_PLATFORM_MAX_WIDTH) / 2)
      : Math.max(params.minWidth, Math.floor((params.minWidth + params.maxWidth) / 2))
    const safeHeight = Math.max(params.minHeight, Math.floor((params.minHeight + params.maxHeight) / 2))
    const safeGapY = MIN_PLATFORM_GAP_Y
    const leftSafeX = fromPlatform.x - PLATFORM_HORIZONTAL_CLEARANCE - safeWidth
    const rightSafeX = fromPlatform.x + fromPlatform.width + PLATFORM_HORIZONTAL_CLEARANCE
    const canPlaceLeft = leftSafeX >= 0
    const canPlaceRight = rightSafeX <= SCREEN_WIDTH - safeWidth
  
    let safeX
    if (canPlaceLeft && canPlaceRight) {
      safeX = Phaser.Math.Between(0, 1) === 0 ? leftSafeX : rightSafeX
    } else if (canPlaceRight) {
      safeX = rightSafeX
    } else if (canPlaceLeft) {
      safeX = leftSafeX
    } else {
      safeX = Phaser.Math.Clamp(fromPlatform.x + fromPlatform.width + PLATFORM_HORIZONTAL_CLEARANCE, 0, SCREEN_WIDTH - safeWidth)
    }
  
    return {
      x: safeX,
      y: fromPlatform.y - safeGapY,
      width: safeWidth,
      height: safeHeight,
      isWide: nextIsWide,
      flagCollected: false,
    }
  },
}

globalThis.FLOWCLIMB_PLATFORM_METHODS = FLOWCLIMB_PLATFORM_METHODS
