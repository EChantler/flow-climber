const SCREEN_WIDTH = 720
const SCREEN_HEIGHT = 800

const GRAVITY_RISE = 0.46
const GRAVITY_FALL = 0.9
const JUMP_VELOCITY = -11.2
const MAX_FALL_SPEED = 14.0
const PLAYER_WALK_SPEED = 1.7
const PLAYER_RUN_SPEED = 6.4
const PLAYER_GROUND_ACCEL = 0.085
const PLAYER_GROUND_DECEL = 0.11
const PLAYER_LANDING_DECEL = 0.22
const PLAYER_AIR_ACCEL = 0.055
const PLAYER_AIR_DECEL = 0.08
const RUN_UP_BUILD_TIME_MS = 420
const JUMP_BUFFER_MS = 120
const COYOTE_TIME_MS = 100
const UNSTUCK_DEATH_THRESHOLD = 5
const UNSTUCK_WINDOW_MS = 30000
const MISSED_FLAG_PENALTY = 2
const INITIAL_OBJECTIVE_PLATFORM_INDEX = 1

const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 10
const DIFFICULTY_SCORE_STEP = 6
const START_PLATFORM_BOTTOM_MARGIN = 34

const PLAYER_WIDTH = 24
const PLAYER_HEIGHT = 32

const PLATFORM_MIN_WIDTH_EASY = 40
const PLATFORM_MAX_WIDTH_EASY = 100
const PLATFORM_MIN_WIDTH_HARD = 30
const PLATFORM_MAX_WIDTH_HARD = 80
const WIDE_PLATFORM_MIN_WIDTH = 150
const WIDE_PLATFORM_MAX_WIDTH = 230
const WIDE_PLATFORM_CHANCE = 0.35
const PLATFORM_MIN_HEIGHT_EASY = 10
const PLATFORM_MAX_HEIGHT_EASY = 10
const PLATFORM_MIN_HEIGHT_HARD = 10
const PLATFORM_MAX_HEIGHT_HARD = 10

const PLATFORM_MIN_GAP_Y_EASY = 100
const PLATFORM_MIN_GAP_Y_HARD = 120
const PLATFORM_MAX_GAP_Y_EASY = 112
const PLATFORM_MAX_GAP_Y_HARD = 144

const PLATFORM_MIN_X_SHIFT_EASY = 130
const PLATFORM_MIN_X_SHIFT_HARD = 200
const PLATFORM_MAX_X_SHIFT_EASY = 170
const PLATFORM_MAX_X_SHIFT_HARD = 250
const PLATFORM_HORIZONTAL_CLEARANCE = 8

const FLAG_POLE_HEIGHT = 20
const FLAG_WIDTH = 12
const FLAG_HEIGHT = 8

const MAX_FRAME_SCALE = 1.5
const RESPAWN_PLATFORM_SCREEN_Y = 620
const RESPAWN_GRACE_FRAMES = 10
const FLAG_COLLECT_GRACE_FRAMES = 12
const OVERSHOOT_MARGIN = 8
const RUN_UP_REQUIRED_CHANCE = 0.35
const CENTER_DEPARTURE_HALF_WIDTH = 16
const MOVING_PLATFORM_CHANCE = 0.45
const MOVING_PLATFORM_SPEED_MIN = 0.45
const MOVING_PLATFORM_SPEED_MAX = 1.2
const MOVING_PLATFORM_RANGE_MIN = 72
const MOVING_PLATFORM_RANGE_MAX = 180
const PLATFORMS_BEHIND_TO_KEEP = 2
const PLATFORMS_AHEAD_TO_KEEP = 11
const PLATFORM_WINDOW_SIZE = PLATFORMS_BEHIND_TO_KEEP + PLATFORMS_AHEAD_TO_KEEP
const CAMERA_FOLLOW_LERP = 0.08
const PLAYER_CAMERA_TARGET_SCREEN_Y = SCREEN_HEIGHT * 0.58
const FALL_BELOW_LOWEST_PLATFORM_MARGIN = 120
const MIN_PLATFORM_GAP_Y = Math.ceil(PLAYER_HEIGHT * 1.5)
const SPAWN_RANDOM_ATTEMPTS = 200
const DIFFICULTY_UPDATE_INTERVAL_MS = 10000
const GAME_VERSION = "v0.2.26"
const WORLD_ZOOM = 0.9

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
    this.configureInputStability()

    this.scoreText = this.add.text(14, 12, "", { fontSize: "18px", color: "#ffffff" })
    this.flagsText = this.add.text(14, 34, "", { fontSize: "18px", color: "#ffffff" })
    this.deathsText = this.add.text(14, 56, "", { fontSize: "18px", color: "#ffffff" })
    this.difficultyText = this.add.text(14, 78, "", { fontSize: "18px", color: "#ffffff" })
    this.controlsText = this.add.text(14, 110, "Move: A/D or Left/Right", { fontSize: "16px", color: "#d6deea" })
    this.jumpText = this.add.text(14, 130, "Jump: Space", { fontSize: "16px", color: "#d6deea" })
    this.pauseHintText = this.add.text(14, 150, "P: Pause/Resume", { fontSize: "16px", color: "#d6deea" })
    this.restartText = this.add.text(14, 170, "R: Restart run", { fontSize: "16px", color: "#d6deea" })
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
    this.jumpBufferExpiresAt = 0
    this.coyoteExpiresAt = 0
    this.runChargeStartedAt = 0
    this.runCharge = 0
    this.landingTractionExpiresAt = 0
    this.deathTimestamps = []
    this.unstuckAvailable = false

    void this.bootstrapAccessControl()
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

      this.logTelemetry("session_start", 0, { version: GAME_VERSION })

      const accepted = await this.flushTelemetry()
      if (!accepted || this.accessBlocked) {
        if (!this.accessBlocked) {
          this.blockAccess("Access token rejected", "Refresh and enter a valid access token.")
        }
        return
      }

      this.initializeSpawnWorker()
      this.telemetry.start()
      this.resetWorld()
      this.gameReady = true
      this.accessOverlay.setVisible(false)
      this.accessOverlayHint.setVisible(false)
    } catch (error) {
      console.error("Access validation failed:", error)
      this.blockAccess("Could not validate access token", "Refresh and try again.")
    }
  }

  resetWorld() {
    this.resetFallbackKeys()
    this.spawnPrefetch = null
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

    const nextPlatform = this.getNextPlatform(startPlatform, DIFFICULTY_MIN)
    this.platforms = [this.decoratePlatform(startPlatform, DIFFICULTY_MIN, false), nextPlatform]
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
    this.flagsCollected = 0
    this.deathPenalty = 0
    this.score = 0
    this.difficultyLevel = DIFFICULTY_MIN
    this.lastSafePlatform = this.platforms[0]
    this.respawnGraceFrames = 0
    this.flagCollectGraceFrames = 0
    this.lastFlagTimestamp = Date.now()
    this.deathCount = 0
    this.resetCount = 0
    this.runStartTimestamp = Date.now()
    this.maxDifficultyAchieved = DIFFICULTY_MIN
    this.groundPlatform = this.platforms[0]
    this.isPaused = false
    this.pauseOverlay.setVisible(false)
    this.pauseOverlayHint.setVisible(false)

    this.queueSpawnPrefetch(this.platforms[this.platforms.length - 1], this.difficultyLevel)
    this.drawWorld()
  }

  initializeSpawnWorker() {
    if (typeof Worker === "undefined") {
      return
    }

    try {
      this.spawnWorker = new Worker(`./spawn-worker.js?v=${GAME_VERSION}`)
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
      return this.decoratePlatform({
        x: cached.x,
        y: cached.y,
        width: cached.width,
        height: cached.height,
        isWide: !!cached.isWide,
        flagCollected: false,
        flagVisible: false,
      }, difficultyLevel)
    }

    return this.decoratePlatform(this.spawnNextPlatformForLevel(fromPlatform, difficultyLevel), difficultyLevel)
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
    this.updateScore()
    this.flashHudText(this.flagsText)
    this.showScoreIndicator("+1", "#55f28f")
    this.logTelemetry("flag_collect", 1, {
      score: this.score,
      objective_index: this.objectivePlatformIndex,
      difficulty: this.difficultyLevel,
    })

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

    const missedCount = landedPlatformIndex - this.objectivePlatformIndex
    this.deathPenalty += MISSED_FLAG_PENALTY * missedCount
    this.lastFlagTimestamp = now
    this.updateScore()
    this.showScoreIndicator(`-${MISSED_FLAG_PENALTY * missedCount}`, "#ffb84d")
    this.logTelemetry("flag_miss", -(MISSED_FLAG_PENALTY * missedCount), {
      missed_count: missedCount,
      landed_platform_index: landedPlatformIndex,
      score: this.score,
      difficulty: this.difficultyLevel,
    })

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
      this.logTelemetry("run_reset", 0, {
        score: this.score,
        flags_collected: this.flagsCollected,
        deaths: this.deathCount,
      })
      this.resetWorld()
      return
    }

    if (this.isPaused) {
      this.drawWorld()
      return
    }

    this.updateDifficultyFromElapsedTime()

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

    this.player.x += this.player.velocityX * frameScale
    this.player.x = Phaser.Math.Clamp(this.player.x, 0, SCREEN_WIDTH - this.player.width)
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
      this.logTelemetry("death", -deathPenalty, {
        died_while_on_platform: diedWhileOnPlatform,
        score: this.score,
        difficulty: this.difficultyLevel,
      })

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
    this.graphics.fillStyle(0x141a25, 1)
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
    this.flagsText.setText(`Flags: ${this.flagsCollected}`)
    this.deathsText.setText(`Deaths: ${this.deathCount}`)
    const suddenDeathTag = this.difficultyLevel >= DIFFICULTY_MAX + 1 ? " (Sudden Death)" : ""
    this.difficultyText.setText(`Difficulty: ${this.difficultyLevel}${suddenDeathTag}`)
    this.pauseOverlay.setVisible(this.isPaused)
    this.pauseOverlayHint.setVisible(this.isPaused)
    this.unstuckOverlay.setVisible(this.unstuckAvailable)
  }

  initializeTelemetry(telemetryConfig = null) {
    const config = telemetryConfig || this.resolveTelemetryConfig()
    this.telemetry = createTelemetryManager({
      ...config,
      onAccessDenied: (error) => this.handleTelemetryAccessDenied(error),
    })
    if (this.telemetry.enabled) {
      console.info("[Telemetry] participant token", {
        storageKey: this.telemetryParticipantTokenStorageKey,
        source: this.telemetryParticipantTokenSource,
        tokenPreview: this.maskToken(config.participantToken),
        tokenLength: config.participantToken.length,
      })
    }
    if (!this.telemetry.enabled) {
      return
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.telemetry.stop()
      void this.telemetry.flush()
    })
  }

  setAccessOverlay(title, hint) {
    this.accessOverlay.setText(title)
    this.accessOverlayHint.setText(hint)
    this.accessOverlay.setVisible(true)
    this.accessOverlayHint.setVisible(!!hint)
  }

  blockAccess(title, hint) {
    this.accessBlocked = true
    this.gameReady = false
    this.isPaused = false
    this.telemetry?.stop()
    this.setAccessOverlay(title, hint)
    if (this.platforms && this.player) {
      this.drawWorld()
    }
  }

  clearStoredParticipantToken() {
    const storageKey = this.telemetryParticipantTokenStorageKey
    if (storageKey) {
      window.localStorage.removeItem(storageKey)
    }
  }

  handleTelemetryAccessDenied(error) {
    console.error("Telemetry access denied:", error?.message || error)
    this.clearStoredParticipantToken()
    this.blockAccess("Access token rejected", "Refresh and enter a valid access token.")
  }

  resolveTelemetryConfig() {
    const globalConfig = window.__FLOWCLIMB_TELEMETRY__ || {}
    const supabaseUrl = globalConfig.supabaseUrl || window.__SUPABASE_URL__ || ""
    const supabaseAnonKey = globalConfig.supabaseAnonKey || window.__SUPABASE_ANON_KEY__ || ""
    const participantToken = (supabaseUrl && supabaseAnonKey)
      ? this.resolveParticipantToken(globalConfig)
      : ""

    return {
      supabaseUrl,
      supabaseAnonKey,
      participantToken,
      tableName: globalConfig.tableName || "telemetry",
      batchSize: globalConfig.batchSize || 12,
      flushIntervalMs: globalConfig.flushIntervalMs || 15000,
      sessionId: this.sessionId,
    }
  }

  resolveParticipantToken(globalConfig) {
    const storageKey = globalConfig.participantTokenStorageKey || globalConfig.storageKey || "flowclimb_participant_token"
    const existingToken = window.localStorage.getItem(storageKey)
    if (existingToken) {
      this.telemetryParticipantTokenStorageKey = storageKey
      this.telemetryParticipantTokenSource = "localStorage"
      return existingToken.trim()
    }

    const token = window.prompt("Enter participant token")
    if (token) {
      const trimmedToken = token.trim()
      window.localStorage.setItem(storageKey, trimmedToken)
      this.telemetryParticipantTokenStorageKey = storageKey
      this.telemetryParticipantTokenSource = "prompt"
      return trimmedToken
    }

    this.telemetryParticipantTokenStorageKey = storageKey
    this.telemetryParticipantTokenSource = "missing"
    return ""
  }

  maskToken(token) {
    if (!token) {
      return "<empty>"
    }

    if (token.length <= 8) {
      return `${token.slice(0, 2)}…${token.slice(-2)}`
    }

    return `${token.slice(0, 4)}…${token.slice(-4)}`
  }

  logTelemetry(type, value, extra = {}) {
    if (!this.telemetry || !this.telemetry.enabled) {
      return
    }

    this.telemetry.log(type, value, extra)
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
    this.logTelemetry("unstuck", 0, {
      score: this.score,
      flags_collected: this.flagsCollected,
      deaths: this.deathCount,
    })
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
    this.score = this.flagsCollected - this.deathPenalty
  }

  updateDifficultyFromElapsedTime() {
    const elapsedMs = Date.now() - this.runStartTimestamp
    const timedDifficulty = DIFFICULTY_MIN + Math.floor(elapsedMs / DIFFICULTY_UPDATE_INTERVAL_MS)
    this.difficultyLevel = Math.max(DIFFICULTY_MIN, timedDifficulty)
    this.maxDifficultyAchieved = Math.max(this.maxDifficultyAchieved, this.difficultyLevel)
  }

  showScoreIndicator(text, color) {
    const playerCenterX = this.worldToScreenX(this.player.x + this.player.width / 2)
    const playerTopY = this.worldToScreenY(this.player.y)
    const startX = Phaser.Math.Clamp(playerCenterX, 14, SCREEN_WIDTH - 14)
    const startY = Phaser.Math.Clamp(playerTopY - 12, 12, SCREEN_HEIGHT - 12)

    const indicator = this.add.text(startX, startY, text, {
      fontSize: "14px",
      color,
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(1000)

    this.tweens.add({
      targets: indicator,
      y: indicator.y - 18,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => {
        indicator.destroy()
      },
    })
  }

  flashHudText(textObject) {
    if (!textObject) {
      return
    }

    this.tweens.killTweensOf(textObject)
    textObject.setScale(1)
    this.tweens.add({
      targets: textObject,
      scaleX: 1.12,
      scaleY: 1.12,
      yoyo: true,
      duration: 110,
      ease: "Sine.easeOut",
    })
  }

  setupKeyboardFallback() {
    this.fallbackKeyState = {
      left: false,
      right: false,
    }
    this.pendingActionPress = {
      space: false,
      r: false,
      u: false,
      p: false,
    }

    const trackedCodes = new Set([
      "ArrowLeft",
      "ArrowRight",
      "KeyA",
      "KeyD",
      "Space",
      "KeyR",
      "KeyU",
      "KeyP",
    ])
    this.windowKeyDownHandler = (event) => {
      if (!trackedCodes.has(event.code)) {
        return
      }
      if (event.repeat) {
        return
      }
      event.preventDefault()
      this.updateFallbackKeyStateOnDown(event.code)
    }
    this.windowKeyUpHandler = (event) => {
      if (!trackedCodes.has(event.code)) {
        return
      }
      event.preventDefault()
      this.updateFallbackKeyStateOnUp(event.code)
    }
    window.addEventListener("keydown", this.windowKeyDownHandler)
    window.addEventListener("keyup", this.windowKeyUpHandler)

    window.addEventListener("blur", () => {
      this.resetFallbackKeys()
    })
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.resetFallbackKeys()
      }
    })
  }

  updateFallbackKeyStateOnDown(code) {
    if (code === "ArrowLeft" || code === "KeyA") {
      this.fallbackKeyState.left = true
      this.fallbackKeyState.right = false
      return
    }
    if (code === "ArrowRight" || code === "KeyD") {
      this.fallbackKeyState.right = true
      this.fallbackKeyState.left = false
      return
    }
    if (code === "Space") {
      this.pendingActionPress.space = true
      return
    }
    if (code === "KeyR") {
      this.pendingActionPress.r = true
      return
    }
    if (code === "KeyU") {
      this.pendingActionPress.u = true
      return
    }
    if (code === "KeyP") {
      this.pendingActionPress.p = true
    }
  }

  updateFallbackKeyStateOnUp(code) {
    if (code === "ArrowLeft" || code === "KeyA") {
      this.fallbackKeyState.left = false
      return
    }
    if (code === "ArrowRight" || code === "KeyD") {
      this.fallbackKeyState.right = false
    }
  }

  resetFallbackKeys() {
    this.fallbackKeyState.left = false
    this.fallbackKeyState.right = false
    this.pendingActionPress.space = false
    this.pendingActionPress.r = false
    this.pendingActionPress.u = false
    this.pendingActionPress.p = false
  }

  isMoveLeftPressed() {
    return this.fallbackKeyState.left
  }

  isMoveRightPressed() {
    return this.fallbackKeyState.right
  }

  consumeActionPress(actionName) {
    const pressed = !!this.pendingActionPress[actionName]
    this.pendingActionPress[actionName] = false
    return pressed
  }

  configureInputStability() {
    this.input.keyboard.enabled = true
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.U,
      Phaser.Input.Keyboard.KeyCodes.P,
    ])

    const canvas = this.game.canvas
    if (canvas) {
      canvas.setAttribute("tabindex", "0")
      canvas.addEventListener("pointerdown", () => {
        canvas.focus()
      })
      canvas.focus()
    }

    this.game.events.on("hidden", () => {
      this.input.keyboard.resetKeys()
      this.resetFallbackKeys()
    })
    this.game.events.on("visible", () => {
      this.input.keyboard.resetKeys()
      this.resetFallbackKeys()
      if (canvas) {
        canvas.focus()
      }
    })
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
