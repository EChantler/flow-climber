const FLOWCLIMB_RUN_STATE_METHODS = {
  startRun(mode) {
    this.resetSessionId()
    this.gameMode = mode
    this.selectedFlowModel = mode === FLOWCLIMB_MODES.FLOW ? Phaser.Utils.Array.GetRandom(FLOW_MODEL_NAMES) : null
    this.lastChallengeLabel = FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE
    this.lastFlowModelUpdateTimestamp = Date.now()
    this.lastFlagsForModel = 0
    this.lastDeathsForModel = 0
    this.lastHeightForModel = 0
    this.resetWorld()
  },

  resetWorld() {
    this.screenState = "playing"
    this.setTrainIntroVisible(false)
    this.setMenuVisible(false)
    this.setHudVisible(true)
    this.modelText.setVisible(this.gameMode === FLOWCLIMB_MODES.FLOW)
    this.setTouchControlsVisible(true)
    this.resetFallbackKeys()
    this.spawnPrefetch = null
    this.nextPlatformId = 0
    const startParams = this.currentSpawnParams(DIFFICULTY_MIN)
    const startIsWide = Math.random() < WIDE_PLATFORM_CHANCE
    const [startWidth, startHeight] = this.randomPlatformDimensions(startParams, startIsWide)
  
    const startPlatform = {
      x: Math.floor(SCREEN_WIDTH / 2 - startWidth / 2),
      y: SCREEN_HEIGHT - START_PLATFORM_BOTTOM_MARGIN - startHeight,
      width: startWidth,
      height: startHeight,
      isWide: startIsWide,
      flagCollected: false,
      flagVisible: false,
    }
  
    this.assignPlatformId(startPlatform)
    const nextPlatform = this.getNextPlatform(startPlatform, DIFFICULTY_MIN)
    this.platforms = [this.decoratePlatform(startPlatform, DIFFICULTY_MIN, false), nextPlatform]
    this.platforms[0].reached = true
    this.objectivePlatformIndex = INITIAL_OBJECTIVE_PLATFORM_INDEX
    this.ensurePlatformBuffer(DIFFICULTY_MIN)
    this.syncCollectibleFlags()
  
    this.player = {
      x: startPlatform.x + startPlatform.width / 2 - PLAYER_WIDTH / 2,
      y: startPlatform.y - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityX: 0,
      velocityY: 0,
      onGround: true,
    }
    this.playerFacing = 1
    this.jumpBufferExpiresAt = 0
    this.coyoteExpiresAt = Date.now() + COYOTE_TIME_MS
    this.runChargeStartedAt = 0
    this.runCharge = 0
    this.landingTractionExpiresAt = 0
    this.deathTimestamps = []
    this.unstuckAvailable = false
    this.unstuckOverlay.setVisible(false)
    this.setTouchTeleportVisible(false)
  
    this.cameraY = this.player.y - PLAYER_CAMERA_TARGET_SCREEN_Y
    this.runStartHeightY = this.player.y
    this.heightClimbed = 0
    this.flagsCollected = 0
    this.deathPenalty = 0
    this.skipReward = 0
    this.score = 0
    this.difficultyLevel = DIFFICULTY_MIN
    this.lastSafePlatform = this.platforms[0]
    this.respawnGraceFrames = 0
    this.flagCollectGraceFrames = 0
    this.lastFlagTimestamp = Date.now()
    this.deathCount = 0
    this.resetCount = 0
    this.runStartTimestamp = Date.now()
    this.lastFlowModelUpdateTimestamp = this.runStartTimestamp
    this.lastTelemetryWindowTimestamp = this.runStartTimestamp
    this.lastFlagsForModel = 0
    this.lastDeathsForModel = 0
    this.lastHeightForModel = 0
    this.telemetryWindowIndex = 0
    this.resetWindowTelemetryCounters(this.runStartTimestamp, 0)
    this.maxDifficultyAchieved = DIFFICULTY_MIN
    this.groundPlatform = this.platforms[0]
    this.jumpStartedPlatform = null
    this.jumpTargetPlatform = null
    this.isPaused = false
    this.pauseOverlay.setVisible(false)
    this.pauseOverlayHint.setVisible(false)
  
    this.queueSpawnPrefetch(this.platforms[this.platforms.length - 1], this.difficultyLevel)
    this.drawWorld()
  },

  recordDeathTimestamp(timestamp) {
    this.deathTimestamps.push(timestamp)
  },

  recordFailedJumpAttempt() {
    if (!this.windowTelemetry) {
      return
    }
  
    const fromPlatform = this.jumpStartedPlatform || this.groundPlatform || this.lastSafePlatform
    const toPlatform = this.jumpTargetPlatform || this.platforms?.[this.objectivePlatformIndex] || null
    if (!fromPlatform || !toPlatform) {
      return
    }
  
    const fromId = fromPlatform.id ?? "unknown"
    const toId = toPlatform.id ?? "unknown"
    const jumpKey = `${fromId}->${toId}`
    this.windowTelemetry.failedJumpAttempts += 1
    this.windowTelemetry.failedJumpCountsByJump[jumpKey] = (this.windowTelemetry.failedJumpCountsByJump[jumpKey] || 0) + 1
  },

  updateUnstuckAvailability(now = Date.now()) {
    const cutoff = now - UNSTUCK_WINDOW_MS
    this.deathTimestamps = this.deathTimestamps.filter((timestamp) => timestamp >= cutoff)
    this.unstuckAvailable = this.deathTimestamps.length >= UNSTUCK_DEATH_THRESHOLD
    this.unstuckOverlay.setText(
      this.unstuckAvailable
        ? "Teleport available\nPress U or tap Teleport"
        : "",
    )
    this.setTouchTeleportVisible(this.unstuckAvailable)
  },

  performUnstuckTeleport() {
    const targetPlatform = this.platforms[PLATFORMS_BEHIND_TO_KEEP]
    if (!targetPlatform) {
      return
    }
  
    const now = Date.now()
    this.player.x = targetPlatform.x + targetPlatform.width / 2 - this.player.width / 2
    this.player.y = targetPlatform.y - this.player.height
    this.player.velocityX = 0
    this.player.velocityY = 0
    this.player.onGround = true
    this.jumpStartedPlatform = null
    this.jumpTargetPlatform = null
    this.lastSafePlatform = targetPlatform
    this.groundPlatform = targetPlatform
    this.cameraY = targetPlatform.y - PLAYER_CAMERA_TARGET_SCREEN_Y
    this.respawnGraceFrames = RESPAWN_GRACE_FRAMES
    this.flagCollectGraceFrames = FLAG_COLLECT_GRACE_FRAMES
    this.coyoteExpiresAt = now + COYOTE_TIME_MS
    this.jumpBufferExpiresAt = 0
    this.runChargeStartedAt = 0
    this.runCharge = 0
    this.landingTractionExpiresAt = now + 180
    this.deathTimestamps = []
    this.unstuckAvailable = false
    this.unstuckOverlay.setVisible(false)
    this.setTouchTeleportVisible(false)
    this.showScoreIndicator("UNSTUCK", "#ffe08a")
  },

  updateScore() {
    this.score = this.flagsCollected + this.skipReward - this.deathPenalty
  },

  updateHeightClimbed() {
    const climbed = Math.max(0, Math.floor(this.runStartHeightY - this.player.y))
    this.heightClimbed = Math.max(this.heightClimbed, climbed)
  },
}

globalThis.FLOWCLIMB_RUN_STATE_METHODS = FLOWCLIMB_RUN_STATE_METHODS
