const TELEMETRY_SCHEMA_VERSION = 6
const GAME_VERSION = "v0.5.0"

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
    this.difficultyText = this.add.text(14, 100, "", { fontSize: "18px", color: "#ffffff" }).setVisible(false)
    this.modeText = this.add.text(14, 122, "", { fontSize: "18px", color: "#ffffff" }).setVisible(false)
    this.modelText = this.add.text(14, 144, "", { fontSize: "16px", color: "#d6deea" }).setVisible(false)
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
    this.unstuckOverlay = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 128, "", {
      fontSize: "18px",
      color: "#ffe08a",
      backgroundColor: "rgba(10, 14, 20, 0.72)",
      align: "center",
      wordWrap: { width: SCREEN_WIDTH - 72 },
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setVisible(false)

    this.hudTexts = [
      this.scoreText,
      this.heightText,
      this.flagsText,
      this.deathsText,
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
    this.resetSessionId()
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

  update(_, delta) {
    if (!this.gameReady) {
      return
    }

    if (this.screenState === "menu" || this.screenState === "mode_intro") {
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

}

Object.assign(EndlessClimberScene.prototype, FLOWCLIMB_UI_METHODS, FLOWCLIMB_INPUT_METHODS, FLOWCLIMB_TELEMETRY_METHODS, FLOWCLIMB_PLATFORM_METHODS, FLOWCLIMB_RENDERING_METHODS, FLOWCLIMB_DIFFICULTY_METHODS, FLOWCLIMB_RUN_STATE_METHODS)

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
