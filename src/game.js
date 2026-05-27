const TELEMETRY_SCHEMA_VERSION = 6
const GAME_VERSION = "v0.15.3"

class EndlessClimberScene extends Phaser.Scene {
  constructor() {
    super("EndlessClimberScene")
  }

  create() {
    this.graphics = this.add.graphics()
    this.cameras.main.setBackgroundColor("#0f1722")
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.setupKeyboardFallback()
    this.setupTouchControls()
    this.configureInputStability()

    this.scoreText = this.add.text(14, 12, "", { fontSize: "18px", color: "#ffffff" })
    this.heightText = this.add.text(14, 34, "", { fontSize: "18px", color: "#ffffff" })
    this.flagsText = this.add.text(14, 56, "", { fontSize: "18px", color: "#ffffff" })
    this.deathsText = this.add.text(14, 78, "", { fontSize: "18px", color: "#ffffff" })
    this.difficultyText = this.add.text(14, 100, "", { fontSize: "18px", color: "#ffffff" })
    this.modeText = this.add.text(14, 122, "", { fontSize: "18px", color: "#ffffff" })
    this.modelText = this.add.text(14, 144, "", { fontSize: "16px", color: "#d6deea" })
    this.controlsText = this.add.text(14, 176, "Move: A/D or Left/Right", { fontSize: "16px", color: "#d6deea" })
    this.jumpText = this.add.text(14, 196, "Jump: Space", { fontSize: "16px", color: "#d6deea" })
    this.pauseHintText = this.add.text(14, 216, "P: Pause/Resume", { fontSize: "16px", color: "#d6deea" })
    this.restartText = this.add.text(14, 236, "R: Restart run   Q: Quit to menu", { fontSize: "16px", color: "#d6deea" })
    this.uploadIcon = this.add.text(14, SCREEN_HEIGHT - 28, "↥", {
      fontSize: "14px",
      color: "#93a4bd",
      alpha: 0.45,
    }).setOrigin(0, 1).setVisible(false)
    this.versionText = this.add.text(SCREEN_WIDTH - 10, SCREEN_HEIGHT - 8, `FlowClimb ${GAME_VERSION}`, {
      fontSize: "12px",
      color: "#93a4bd",
    }).setOrigin(1, 1)
    this.pauseOverlay = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 12, "Paused", {
      fontSize: "48px",
      color: "#ffffff",
    }).setOrigin(0.5).setVisible(false)
    this.pauseOverlayHint = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 34, "Press P to resume", {
      fontSize: "22px",
      color: "#d6deea",
    }).setOrigin(0.5).setVisible(false)
    this.accessOverlay = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 12, "Checking access token...", {
      fontSize: "34px",
      color: "#ffffff",
      backgroundColor: "rgba(10, 14, 20, 0.72)",
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setVisible(true)
    this.accessOverlayHint = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 34, "", {
      fontSize: "20px",
      color: "#d6deea",
    }).setOrigin(0.5).setVisible(true)
    this.unstuckOverlay = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 118, "", {
      fontSize: "20px",
      color: "#ffe08a",
      backgroundColor: "rgba(10, 14, 20, 0.72)",
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setVisible(false)

    this.hudTexts = [
      this.scoreText,
      this.heightText,
      this.flagsText,
      this.deathsText,
      this.difficultyText,
      this.modeText,
      this.modelText,
      this.controlsText,
      this.jumpText,
      this.pauseHintText,
      this.restartText,
    ]
    this.hudTexts.forEach((text) => text.setVisible(false))
    this.createMenuScreen()
    this.setMenuVisible(false)
    this.setTouchControlsVisible(false)

    this.playerName = "player"
    this.pendingTelemetry = []
    this.telemetry = null
    this.sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    this.spawnWorker = null
    this.spawnPrefetch = null
    this.latestSpawnRequestId = 0
    this.lastFlagTimestamp = Date.now()
    this.deathCount = 0
    this.accessBlocked = false
    this.gameReady = false
    this.isPaused = false
    this.heightClimbed = 0
    this.runStartHeightY = 0
    this.jumpBufferExpiresAt = 0
    this.coyoteExpiresAt = 0
    this.runChargeStartedAt = 0
    this.runCharge = 0
    this.landingTractionExpiresAt = 0
    this.deathTimestamps = []
    this.unstuckAvailable = false
    this.uploadIconTimer = null
    this.screenState = "loading"
    this.gameMode = null
    this.selectedFlowModel = null
    this.lastFlowModelUpdateTimestamp = 0
    this.lastTelemetryWindowTimestamp = 0
    this.lastChallengeLabel = FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE
    this.flowOnnxModel = createFlowClimbOnnxChallengeModel()
    this.flowOnnxModelReady = false
    this.difficultyUpdateInProgress = false
    this.lastFlagsForModel = 0
    this.lastDeathsForModel = 0
    this.lastHeightForModel = 0
    this.windowTelemetry = null
    this.telemetryWindowIndex = 0
    this.jumpStartedPlatform = null
    this.jumpTargetPlatform = null
    this.nextPlatformId = 0

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.teardownTouchControls()
    })

    void this.bootstrapAccessControl()
  }

  startRun(mode) {
    this.gameMode = mode
    this.selectedFlowModel = mode === FLOWCLIMB_MODES.FLOW ? Phaser.Utils.Array.GetRandom(FLOW_MODEL_NAMES) : null
    this.lastChallengeLabel = FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE
    this.lastFlowModelUpdateTimestamp = Date.now()
    this.lastFlagsForModel = 0
    this.lastDeathsForModel = 0
    this.lastHeightForModel = 0
    this.resetWorld()
  }

  async bootstrapFlowModel() {
    this.setAccessOverlay("Loading Flow model...", "Preparing the study model.")
    this.flowOnnxModelReady = await this.flowOnnxModel.load()
    if (!this.flowOnnxModelReady) {
      const hint = window.location?.protocol === "file:"
        ? "ONNX models cannot load from file://. Serve the folder over http://localhost and try again."
        : "Please notify the developer and include this message."
      this.blockAccess("Flow model failed to load", hint)
      return false
    }
    return true
  }

  async bootstrapAccessControl() {
    this.setAccessOverlay("Checking access token...", "Submitting startup event.")

    try {
      const telemetryConfig = this.resolveTelemetryConfig()
      this.initializeTelemetry(telemetryConfig)
      if (!this.telemetry.enabled) {
        this.blockAccess("Could not initialize access check", "Refresh and try again.")
        return
      }

      const accepted = await this.validateParticipantAccess(telemetryConfig.participantToken)
      if (!accepted || this.accessBlocked) {
        if (!this.accessBlocked) {
          this.clearStoredParticipantToken()
          this.blockAccess("Access token rejected", "Refresh and enter a valid access token.")
        }
        return
      }

      const flowModelReady = await this.bootstrapFlowModel()
      if (!flowModelReady || this.accessBlocked) {
        return
      }

      this.initializeSpawnWorker()
      this.telemetry.start()
      this.gameReady = true
      this.accessOverlay.setVisible(false)
      this.accessOverlayHint.setVisible(false)
      this.showMenu()
    } catch (error) {
      console.error("Access validation failed:", error)
      this.blockAccess("Could not validate access token", "Refresh and try again.")
    }
  }

  resetWorld() {
    this.screenState = "playing"
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
  }

  incrementWindowCounter(name, amount = 1) {
    if (this.windowTelemetry && Object.prototype.hasOwnProperty.call(this.windowTelemetry, name)) {
      this.windowTelemetry[name] += amount
    }
  }

  resetWindowTelemetryCounters(windowStartTimestamp = Date.now(), windowStartingHeight = this.heightClimbed || 0) {
    this.windowTelemetry = {
      windowStartTimestamp,
      windowStartingHeight,
      jumpLandingsOnNewPlatforms: 0,
      newPlatformsReached: 0,
      deaths: 0,
      horizontalMovement: 0,
      leftKeyPresses: 0,
      rightKeyPresses: 0,
      jumpKeyPresses: 0,
      skippedPlatforms: 0,
      skipReward: 0,
      failedJumpAttempts: 0,
      failedJumpCountsByJump: {},
    }
  }

  assignPlatformId(platform) {
    if (platform.id === undefined || platform.id === null) {
      platform.id = this.nextPlatformId
      this.nextPlatformId += 1
    }
    return platform
  }

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
  }

  spawnPrefetchKey(fromPlatform, difficultyLevel) {
    const wideMarker = fromPlatform.isWide ? 1 : 0
    return `${difficultyLevel}|${fromPlatform.x}|${fromPlatform.y}|${fromPlatform.width}|${fromPlatform.height}|${wideMarker}`
  }

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
  }

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
  }

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
  }

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
  }

  syncCollectibleFlags() {
    for (let i = 0; i < this.platforms.length; i += 1) {
      const platform = this.platforms[i]
      platform.flagVisible = i === this.objectivePlatformIndex && !platform.flagCollected
    }
  }

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
  }

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
  }

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
  }

  update(_, delta) {
    if (!this.gameReady) {
      return
    }

    if (this.screenState === "menu") {
      this.drawMenuBackground()
      return
    }

    if (this.consumeActionPress("q")) {
      this.showMenu()
      return
    }

    if (this.consumeActionPress("p")) {
      this.isPaused = !this.isPaused
      this.pauseOverlay.setVisible(this.isPaused)
      this.pauseOverlayHint.setVisible(this.isPaused)
      this.drawWorld()
      return
    }

    if (this.consumeActionPress("u") && this.unstuckAvailable) {
      this.performUnstuckTeleport()
      return
    }

    if (this.consumeActionPress("r")) {
      this.startRun(this.gameMode || FLOWCLIMB_MODES.TRAIN)
      return
    }

    if (this.isPaused) {
      this.drawWorld()
      return
    }

    void this.updateDifficultyFromElapsedTime()

    const frameScale = Math.min(delta / (1000 / 60), MAX_FRAME_SCALE)
    const now = Date.now()

    this.movePlatforms(frameScale)

    const left = this.isMoveLeftPressed()
    const right = this.isMoveRightPressed()
    let direction = 0
    if (left) direction -= 1
    if (right) direction += 1
    if (direction !== 0) {
      this.playerFacing = direction
    }
    const wasOnGround = this.player.onGround
    if (direction !== 0) {
      if (this.runChargeStartedAt === 0) {
        this.runChargeStartedAt = now
      }
      this.runCharge = Phaser.Math.Clamp((now - this.runChargeStartedAt) / RUN_UP_BUILD_TIME_MS, 0, 1)
    } else {
      this.runChargeStartedAt = 0
      this.runCharge = 0
    }

    const targetSpeed = direction === 0
      ? 0
      : direction * Phaser.Math.Linear(PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, this.runCharge)
    const accel = this.player.onGround ? PLAYER_GROUND_ACCEL : PLAYER_AIR_ACCEL
    const landingBoostActive = this.player.onGround && now <= this.landingTractionExpiresAt
    const decel = this.player.onGround
      ? (landingBoostActive ? PLAYER_LANDING_DECEL : PLAYER_GROUND_DECEL)
      : PLAYER_AIR_DECEL
    const blendRate = direction === 0 ? decel : accel
    this.player.velocityX = Phaser.Math.Linear(this.player.velocityX, targetSpeed, Math.min(1, blendRate * frameScale))

    if (direction === 0 && Math.abs(this.player.velocityX) < PLAYER_WALK_SPEED * 0.08) {
      this.player.velocityX = 0
    }

    const xBeforeMove = this.player.x
    this.player.x += this.player.velocityX * frameScale
    this.player.x = Phaser.Math.Clamp(this.player.x, 0, SCREEN_WIDTH - this.player.width)
    if (this.windowTelemetry) {
      this.windowTelemetry.horizontalMovement += Math.abs(this.player.x - xBeforeMove)
    }
    if (this.player.x <= 0 || this.player.x >= SCREEN_WIDTH - this.player.width) {
      this.player.velocityX = 0
    }

    if (this.consumeActionPress("space")) {
      this.jumpBufferExpiresAt = now + JUMP_BUFFER_MS
    }

    if (this.player.onGround) {
      this.coyoteExpiresAt = now + COYOTE_TIME_MS
    }

    const canJump = this.player.onGround || now <= this.coyoteExpiresAt
    if (this.jumpBufferExpiresAt > 0 && now <= this.jumpBufferExpiresAt && canJump) {
      this.player.velocityY = JUMP_VELOCITY
      this.player.onGround = false
      this.jumpStartedPlatform = this.groundPlatform
      this.jumpTargetPlatform = this.platforms[this.objectivePlatformIndex] || null
      this.jumpBufferExpiresAt = 0
      this.coyoteExpiresAt = 0
    }

    const previousTop = this.player.y
    const previousBottom = this.player.y + this.player.height
    const previousLeft = this.player.x
    const previousRight = this.player.x + this.player.width
    let landedPlatformIndex = -1

    if (this.player.velocityY < 0) {
      this.player.velocityY += GRAVITY_RISE * frameScale
    } else {
      this.player.velocityY += GRAVITY_FALL * frameScale
    }
    this.player.velocityY = Math.min(this.player.velocityY, MAX_FALL_SPEED)
    this.player.y += this.player.velocityY * frameScale
    this.player.onGround = false

    for (const platform of this.platforms) {
      const playerLeft = this.player.x
      const playerRight = this.player.x + this.player.width
      const playerTop = this.player.y
      const playerBottom = this.player.y + this.player.height
      const platformLeft = platform.x
      const platformRight = platform.x + platform.width
      const platformTop = platform.y
      const platformBottom = platform.y + platform.height
      const overlapX = playerRight > platformLeft && playerLeft < platformRight
      const overlapY = playerBottom > platformTop && playerTop < platformBottom
      if (!overlapX || !overlapY) {
        continue
      }

      const landedFromAbove = (
        this.player.velocityY > 0 &&
        previousBottom <= platformTop &&
        playerBottom >= platformTop
      )
      if (landedFromAbove) {
        this.player.y = platformTop - this.player.height
        this.player.velocityY = 0
        this.player.onGround = true
        this.coyoteExpiresAt = now + COYOTE_TIME_MS
        this.landingTractionExpiresAt = now + 180
        if (!wasOnGround) {
          this.player.velocityX = direction !== 0 ? targetSpeed : 0
        }
        if (!platform.reached) {
          platform.reached = true
          this.incrementWindowCounter("newPlatformsReached")
        }
        if (this.jumpStartedPlatform && this.jumpStartedPlatform !== platform) {
          this.incrementWindowCounter("jumpLandingsOnNewPlatforms")
        }
        this.jumpStartedPlatform = null
        this.jumpTargetPlatform = null
        this.lastSafePlatform = platform
        this.groundPlatform = platform
        landedPlatformIndex = this.platforms.indexOf(platform)
        break
      }

      const hitFromBelow = (
        this.player.velocityY < 0 &&
        previousTop >= platformBottom &&
        playerTop <= platformBottom
      )
      if (hitFromBelow) {
        this.player.y = platformBottom
        this.player.velocityY = 0
        break
      }

      const hitFromLeftSide = previousRight <= platformLeft && playerRight > platformLeft
      if (hitFromLeftSide) {
        this.player.x = platformLeft - this.player.width
        this.player.velocityX = 0
        break
      }

      const hitFromRightSide = previousLeft >= platformRight && playerLeft < platformRight
      if (hitFromRightSide) {
        this.player.x = platformRight
        this.player.velocityX = 0
        break
      }
    }

    this.updateHeightClimbed()

    if (this.flagCollectGraceFrames > 0) {
      this.flagCollectGraceFrames -= 1
    }

    const targetPlatform = this.platforms[this.objectivePlatformIndex]
    if (targetPlatform && targetPlatform.flagVisible && this.player.onGround && this.flagCollectGraceFrames === 0) {
      const trigger = this.flagTriggerRect(targetPlatform)
      const onPlatform = Math.abs(this.player.y + this.player.height - targetPlatform.y) < 0.5
      const touchingFlag = this.rectsOverlap(this.player, trigger)

      if (onPlatform && touchingFlag) {
        this.collectCurrentObjective(Date.now())
      }
    }

    if (landedPlatformIndex > this.objectivePlatformIndex) {
      this.advanceAfterSkippedLanding(landedPlatformIndex, now)
    }

    const lowestPlatform = this.platforms[0]
    if (this.respawnGraceFrames > 0) {
      this.respawnGraceFrames -= 1
    } else if (this.player.y > lowestPlatform.y + FALL_BELOW_LOWEST_PLATFORM_MARGIN) {
      this.deathCount += 1
      this.incrementWindowCounter("deaths")
      this.recordFailedJumpAttempt()
      this.recordDeathTimestamp(now)
      this.flashHudText(this.deathsText)
      const diedWhileOnPlatform = this.player.onGround
      const deathPenalty = diedWhileOnPlatform ? 3 : 1
      this.deathPenalty += deathPenalty
      if (diedWhileOnPlatform) {
        this.resetCount += 1
        this.flashHudText(this.restartText)
      }
      this.updateScore()

      let respawnPlatform = this.lastSafePlatform
      if (!this.platforms.includes(respawnPlatform)) {
        respawnPlatform = lowestPlatform
      }

      this.player.x = respawnPlatform.x + respawnPlatform.width / 2 - this.player.width / 2
      if (diedWhileOnPlatform) {
        this.player.y = respawnPlatform.y - this.player.height
        this.player.onGround = true
      } else {
        this.player.y = respawnPlatform.y - this.player.height
        this.player.onGround = true
      }
      this.player.velocityY = 0
      this.player.velocityX = 0
      this.jumpStartedPlatform = null
      this.jumpTargetPlatform = null
      this.respawnGraceFrames = RESPAWN_GRACE_FRAMES
      this.flagCollectGraceFrames = FLAG_COLLECT_GRACE_FRAMES
      this.groundPlatform = respawnPlatform
      this.cameraY = respawnPlatform.y - PLAYER_CAMERA_TARGET_SCREEN_Y
      this.coyoteExpiresAt = now + COYOTE_TIME_MS
      this.jumpBufferExpiresAt = 0
      this.runChargeStartedAt = 0
      this.runCharge = 0
      this.landingTractionExpiresAt = now + 180

      this.ensurePlatformBuffer(this.difficultyLevel)
      this.queueSpawnPrefetch(this.platforms[this.platforms.length - 1], this.difficultyLevel)

      this.showScoreIndicator(`-${deathPenalty}`, "#ff6b6b")
    }

    this.updateUnstuckAvailability(now)

    const targetCameraY = this.player.y - PLAYER_CAMERA_TARGET_SCREEN_Y
    this.cameraY = Phaser.Math.Linear(this.cameraY, targetCameraY, Math.min(1, CAMERA_FOLLOW_LERP * frameScale))

    this.drawWorld()
  }

  drawWorld() {
    this.graphics.clear()
    this.graphics.fillStyle(this.backgroundColorForHeight(this.heightClimbed), 1)
    this.graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)

    for (const platform of this.platforms) {
      const drawX = this.worldToScreenX(platform.x)
      const drawY = this.worldToScreenY(platform.y)
      const drawW = this.worldToScreenSize(platform.width)
      const drawH = this.worldToScreenSize(platform.height)

      this.graphics.fillStyle(this.platformFillColor(platform), 1)
      this.graphics.fillRoundedRect(drawX, drawY, drawW, drawH, this.worldToScreenSize(4))

      if (platform.flagVisible) {
        this.graphics.lineStyle(2, 0xf0f0f0, 1)
        this.graphics.beginPath()
        this.graphics.moveTo(drawX + drawW / 2, drawY)
        this.graphics.lineTo(drawX + drawW / 2, drawY - this.worldToScreenSize(FLAG_POLE_HEIGHT))
        this.graphics.strokePath()

        this.graphics.fillStyle(0xe85454, 1)
        this.graphics.fillRect(
          drawX + drawW / 2,
          drawY - this.worldToScreenSize(FLAG_POLE_HEIGHT),
          this.worldToScreenSize(FLAG_WIDTH),
          this.worldToScreenSize(FLAG_HEIGHT),
        )
      }
    }

    const playerDrawX = this.worldToScreenX(this.player.x)
    const playerDrawY = this.worldToScreenY(this.player.y)
    const playerDrawW = this.worldToScreenSize(this.player.width)
    const playerDrawH = this.worldToScreenSize(this.player.height)
    this.graphics.fillStyle(0xff6ec7, 1)
    this.graphics.fillRoundedRect(playerDrawX, playerDrawY, playerDrawW, playerDrawH, this.worldToScreenSize(6))
    this.graphics.fillStyle(0x63d49a, 1)
    this.graphics.fillRect(
      playerDrawX,
      playerDrawY - this.worldToScreenSize(5),
      playerDrawW * this.runCharge,
      this.worldToScreenSize(3),
    )
    this.graphics.fillStyle(0x2d3341, 1)
    if (this.playerFacing < 0) {
      this.graphics.fillTriangle(
        playerDrawX - this.worldToScreenSize(5),
        playerDrawY + playerDrawH / 2,
        playerDrawX + this.worldToScreenSize(6),
        playerDrawY + playerDrawH / 2 - this.worldToScreenSize(5),
        playerDrawX + this.worldToScreenSize(6),
        playerDrawY + playerDrawH / 2 + this.worldToScreenSize(5),
      )
    } else {
      this.graphics.fillTriangle(
        playerDrawX + playerDrawW + this.worldToScreenSize(5),
        playerDrawY + playerDrawH / 2,
        playerDrawX + playerDrawW - this.worldToScreenSize(6),
        playerDrawY + playerDrawH / 2 - this.worldToScreenSize(5),
        playerDrawX + playerDrawW - this.worldToScreenSize(6),
        playerDrawY + playerDrawH / 2 + this.worldToScreenSize(5),
      )
    }

    if (this.isPaused) {
      this.graphics.fillStyle(0x000000, 0.28)
      this.graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    }

    this.scoreText.setText(`Score: ${this.score}`)
    this.heightText.setText(`Height: ${this.heightClimbed}`)
    this.flagsText.setText(`Flags: ${this.flagsCollected}`)
    this.deathsText.setText(`Deaths: ${this.deathCount}`)
    this.difficultyText.setText(`Difficulty: ${this.difficultyLevel}`)
    this.modeText.setText(`Mode: ${this.gameMode === FLOWCLIMB_MODES.FLOW ? "Flow" : "Train"}`)
    this.modelText.setVisible(this.gameMode === FLOWCLIMB_MODES.FLOW)
    const modelStatus = this.selectedFlowModel === FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX
      ? `, onnx: ${this.flowOnnxModel.status}`
      : ""
    this.modelText.setText(`Flow model: ${this.flowModelDisplayName()}${modelStatus} (${this.lastChallengeLabel})`)
    this.pauseOverlay.setVisible(this.isPaused)
    this.pauseOverlayHint.setVisible(this.isPaused)
    this.unstuckOverlay.setVisible(this.unstuckAvailable)
  }

  async validateParticipantAccess(participantToken) {
    if (!this.telemetry || !this.telemetry.enabled || !this.telemetry.supabase) {
      return false
    }

    const { data, error } = await this.telemetry.supabase.rpc("is_valid_participant_token", { token: participantToken })
    if (error) {
      console.error("Access validation RPC failed:", error.message)
      return false
    }
    return data === true
  }

  async flushTelemetry() {
    if (!this.telemetry || !this.telemetry.enabled) {
      return false
    }

    return this.telemetry.flush()
  }

  recordDeathTimestamp(timestamp) {
    this.deathTimestamps.push(timestamp)
  }

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
  }

  updateUnstuckAvailability(now = Date.now()) {
    const cutoff = now - UNSTUCK_WINDOW_MS
    this.deathTimestamps = this.deathTimestamps.filter((timestamp) => timestamp >= cutoff)
    this.unstuckAvailable = this.deathTimestamps.length >= UNSTUCK_DEATH_THRESHOLD
    this.unstuckOverlay.setText(
      this.unstuckAvailable
        ? "Unstuck available: press U to teleport to the next platform"
        : "",
    )
  }

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
    this.showScoreIndicator("UNSTUCK", "#ffe08a")
  }

  platformFillColor(platform) {
    if (!platform.moveDirection || !platform.moveSpeedX) {
      return 0x63d49a
    }

    const travelSpan = Math.max(1, platform.moveMaxX - platform.moveMinX)
    const progress = Phaser.Math.Clamp((platform.x - platform.moveMinX) / travelSpan, 0, 1)
    const distanceFromCenter = Math.abs(progress - 0.5) * 2
    const t = Phaser.Math.Clamp(distanceFromCenter, 0, 1)

    const base = Phaser.Display.Color.IntegerToColor(0x63d49a)
    const warning = Phaser.Display.Color.IntegerToColor(0x8de0c7)
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(base, warning, 100, Math.round(t * 100))
    return Phaser.Display.Color.GetColor(color.r, color.g, color.b)
  }

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
  }

  movingPlatformSpeedForDifficulty(difficultyLevel) {
    const ratio = Phaser.Math.Clamp(this.difficultyRatio(difficultyLevel), 0, 1)
    return Phaser.Math.Linear(MOVING_PLATFORM_SPEED_MIN, MOVING_PLATFORM_SPEED_MAX, ratio)
  }

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
  }

  updateScore() {
    this.score = this.flagsCollected + this.skipReward - this.deathPenalty
  }

  updateHeightClimbed() {
    const climbed = Math.max(0, Math.floor(this.runStartHeightY - this.player.y))
    this.heightClimbed = Math.max(this.heightClimbed, climbed)
  }

  backgroundColorForHeight(heightClimbed) {
    if (BACKGROUND_HEIGHT_STOPS.length === 0) {
      return 0x141a25
    }

    if (heightClimbed <= BACKGROUND_HEIGHT_STOPS[0].height) {
      return BACKGROUND_HEIGHT_STOPS[0].color
    }

    for (let i = 1; i < BACKGROUND_HEIGHT_STOPS.length; i += 1) {
      const previous = BACKGROUND_HEIGHT_STOPS[i - 1]
      const next = BACKGROUND_HEIGHT_STOPS[i]
      if (heightClimbed <= next.height) {
        const range = Math.max(1, next.height - previous.height)
        const progress = Phaser.Math.Clamp((heightClimbed - previous.height) / range, 0, 1)
        const from = Phaser.Display.Color.IntegerToColor(previous.color)
        const to = Phaser.Display.Color.IntegerToColor(next.color)
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 1000, Math.round(progress * 1000))
        return Phaser.Display.Color.GetColor(color.r, color.g, color.b)
      }
    }

    return BACKGROUND_HEIGHT_STOPS[BACKGROUND_HEIGHT_STOPS.length - 1].color
  }

  async updateDifficultyFromElapsedTime() {
    if (this.difficultyUpdateInProgress) {
      return
    }

    const now = Date.now()
    const telemetryElapsedMs = now - this.lastTelemetryWindowTimestamp
    if (telemetryElapsedMs < DIFFICULTY_UPDATE_INTERVAL_MS) {
      return
    }

    this.difficultyUpdateInProgress = true
    if (telemetryElapsedMs > DIFFICULTY_UPDATE_INTERVAL_MS * 2) {
      this.lastTelemetryWindowTimestamp = now
      this.resetWindowTelemetryCounters(now, this.heightClimbed)
      this.difficultyUpdateInProgress = false
      return
    }

    const windowEndTimestamp = this.lastTelemetryWindowTimestamp + DIFFICULTY_UPDATE_INTERVAL_MS
    const latestTelemetry = this.getLatestTelemetryWindow(windowEndTimestamp)
    const previousDifficulty = this.difficultyLevel
    const predictedLabel = await this.predictChallengeLabelForMode(latestTelemetry)
    if (!predictedLabel || this.accessBlocked) {
      this.difficultyUpdateInProgress = false
      return
    }

    this.logTelemetryWindow(latestTelemetry, previousDifficulty, predictedLabel, windowEndTimestamp)

    if (this.gameMode === FLOWCLIMB_MODES.FLOW) {
      if (predictedLabel === FLOWCLIMB_CHALLENGE_LABELS.UNDER) {
        this.difficultyLevel = Math.min(DIFFICULTY_MAX, this.difficultyLevel + FLOW_DIFFICULTY_STEP)
      } else if (predictedLabel === FLOWCLIMB_CHALLENGE_LABELS.OVER) {
        this.difficultyLevel = Math.max(DIFFICULTY_MIN, this.difficultyLevel - FLOW_DIFFICULTY_STEP)
      }
      this.lastChallengeLabel = predictedLabel
      this.lastFlowModelUpdateTimestamp = windowEndTimestamp
      this.maxDifficultyAchieved = Math.max(this.maxDifficultyAchieved, this.difficultyLevel)
    } else {
      const elapsedMs = windowEndTimestamp - this.runStartTimestamp
      const timedDifficulty = DIFFICULTY_MIN + Math.floor(elapsedMs / DIFFICULTY_UPDATE_INTERVAL_MS)
      this.difficultyLevel = Phaser.Math.Clamp(timedDifficulty, DIFFICULTY_MIN, DIFFICULTY_MAX)
      this.maxDifficultyAchieved = Math.max(this.maxDifficultyAchieved, this.difficultyLevel)
    }

    this.lastTelemetryWindowTimestamp = windowEndTimestamp
    this.lastFlagsForModel = this.flagsCollected
    this.lastDeathsForModel = this.deathCount
    this.lastHeightForModel = this.heightClimbed
    this.telemetryWindowIndex += 1
    this.resetWindowTelemetryCounters(windowEndTimestamp, this.heightClimbed)
    this.difficultyUpdateInProgress = false
  }

  flowModelDisplayName() {
    if (this.selectedFlowModel !== FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX) {
      return this.selectedFlowModel || "none"
    }
    return this.flowOnnxModel?.metadata?.promoted_model_name
      || this.flowOnnxModel?.metadata?.model_name
      || "active_onnx"
  }

  gameModeLabel() {
    if (this.gameMode !== FLOWCLIMB_MODES.FLOW) {
      return FLOWCLIMB_GAME_MODE_LABELS.TRAIN
    }
    return this.selectedFlowModel === FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX
      ? FLOWCLIMB_GAME_MODE_LABELS.FLOW_ML
      : FLOWCLIMB_GAME_MODE_LABELS.FLOW_HEURISTIC
  }

  getLatestTelemetryWindow(now) {
    return this.challengeFeatures(now)
  }

  challengeFeatures(now) {
    const elapsedSeconds = Math.max(1, (now - this.runStartTimestamp) / 1000)
    const intervalSeconds = DIFFICULTY_UPDATE_INTERVAL_MS / 1000
    const flagsDelta = this.flagsCollected - this.lastFlagsForModel
    const deathsDelta = this.windowTelemetry.deaths
    const heightDelta = Math.max(0, this.heightClimbed - this.windowTelemetry.windowStartingHeight)
    return {
      elapsedSeconds,
      intervalSeconds,
      flagsDelta,
      deathsDelta,
      heightDelta,
      heightPerMinute: heightDelta / intervalSeconds * 60,
      flagsPerMinute: this.flagsCollected / elapsedSeconds * 60,
      intervalFlagsPerMinute: flagsDelta / intervalSeconds * 60,
      deathsPerMinute: this.deathCount / elapsedSeconds * 60,
      intervalDeathsPerMinute: deathsDelta / intervalSeconds * 60,
      secondsSinceFlag: (now - this.lastFlagTimestamp) / 1000,
      difficulty: this.difficultyLevel,
    }
  }

  async predictChallengeLabelForMode(features) {
    if (this.gameMode === FLOWCLIMB_MODES.FLOW
      && this.selectedFlowModel === FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX) {
      if (!this.flowOnnxModelReady) {
        this.blockAccess("Flow model is not ready", "Please notify the developer and include this message.")
        return null
      }

      try {
        const onnxLabel = await this.flowOnnxModel.predict(features)
        if (onnxLabel) {
          return onnxLabel
        }
      } catch (error) {
        console.error("FlowClimb ONNX prediction failed:", error)
      }
      this.blockAccess("Flow model prediction failed", "Please notify the developer and include this message.")
      return null
    }

    return predictFlowClimbHeuristicChallengeLabel(features)
  }

  flagTriggerRect(platform) {
    return {
      x: platform.x + platform.width / 2 - 8,
      y: platform.y - 16,
      width: 16,
      height: 16,
    }
  }

  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    )
  }

  worldToScreenX(worldX) {
    return (worldX * WORLD_ZOOM) + ((1 - WORLD_ZOOM) * SCREEN_WIDTH / 2)
  }

  worldToScreenY(worldY) {
    return ((worldY - Math.floor(this.cameraY)) * WORLD_ZOOM) + ((1 - WORLD_ZOOM) * SCREEN_HEIGHT / 2)
  }

  worldToScreenSize(value) {
    return Math.max(1, value * WORLD_ZOOM)
  }

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
  }

  difficultyRatio(level) {
    return (level - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN)
  }

  scaleValue(easy, hard, level) {
    return easy + (hard - easy) * this.difficultyRatio(level)
  }

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
  }

  randomPlatformDimensions(params, isWide) {
    const minWidth = isWide ? WIDE_PLATFORM_MIN_WIDTH : params.minWidth
    const maxWidth = isWide ? WIDE_PLATFORM_MAX_WIDTH : params.maxWidth
    return [
      Phaser.Math.Between(minWidth, maxWidth),
      Phaser.Math.Between(params.minHeight, params.maxHeight),
    ]
  }

  intervalOverlaps(minA, maxA, minB, maxB) {
    return !(maxA < minB || minA > maxB)
  }

  isHorizontallyAway(fromPlatform, nextX, nextWidth) {
    const nextRight = nextX + nextWidth
    const fromRight = fromPlatform.x + fromPlatform.width
    const isRightOfCurrent = nextX >= fromRight + PLATFORM_HORIZONTAL_CLEARANCE
    const isLeftOfCurrent = nextRight <= fromPlatform.x - PLATFORM_HORIZONTAL_CLEARANCE
    return isRightOfCurrent || isLeftOfCurrent
  }

  isReachableOnDescent(fromPlatform, nextX, nextWidth, gapY, difficultyLevel) {
    const descent = this.descentLandingWindow(fromPlatform, gapY, difficultyLevel)
    if (descent === null) {
      return false
    }

    const { possibleLeftMin, possibleLeftMax } = descent
    const requiredLeftMin = nextX - PLAYER_WIDTH + 1
    const requiredLeftMax = nextX + nextWidth - 1

    return !(possibleLeftMax < requiredLeftMin || possibleLeftMin > requiredLeftMax)
  }

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
  }

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
  }

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
  }

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
  }
}

Object.assign(EndlessClimberScene.prototype, FLOWCLIMB_UI_METHODS, FLOWCLIMB_INPUT_METHODS, FLOWCLIMB_TELEMETRY_METHODS)

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: "#141a25",
  scene: [EndlessClimberScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
