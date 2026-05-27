function buildFlowClimbTelemetryWindowPayload(input) {
  const failedJumpCounts = input.windowTelemetry.failedJumpCountsByJump
  const repeatedFailedJumpAttempts = Object.values(failedJumpCounts)
    .reduce((total, count) => total + Math.max(0, count - 1), 0)

  return {
    data_schema_version: input.telemetrySchemaVersion,
    window_index: input.telemetryWindowIndex,
    window_started_at: new Date(input.windowTelemetry.windowStartTimestamp).toISOString(),
    window_ended_at: new Date(input.windowEndTimestamp).toISOString(),
    window_duration_ms: input.windowEndTimestamp - input.windowTelemetry.windowStartTimestamp,
    game_mode: input.gameModeLabel,
    deployment_context: input.deploymentContext,
    device_type: input.deviceType,
    vertical_position_y: Math.round(input.player.y),
    height_climbed: input.heightClimbed,
    window_starting_height: input.windowTelemetry.windowStartingHeight,
    score: input.score,
    difficulty: input.difficultyLevel,
    previous_difficulty: input.previousDifficulty,
    challenge_label: input.predictedLabel,
    jumps_landed_on_new_platforms: input.windowTelemetry.jumpLandingsOnNewPlatforms,
    new_platforms_reached: input.windowTelemetry.newPlatformsReached,
    deaths: input.windowTelemetry.deaths,
    skipped_platforms: input.windowTelemetry.skippedPlatforms,
    skip_reward: input.windowTelemetry.skipReward,
    skip_reward_total: input.skipReward,
    failed_jump_attempts: input.windowTelemetry.failedJumpAttempts,
    distinct_failed_jumps: Object.keys(failedJumpCounts).length,
    repeated_failed_jump_attempts: repeatedFailedJumpAttempts,
    failed_jump_counts: failedJumpCounts,
    total_horizontal_movement_px: Math.round(input.windowTelemetry.horizontalMovement),
    left_key_presses: input.windowTelemetry.leftKeyPresses,
    right_key_presses: input.windowTelemetry.rightKeyPresses,
    jump_key_presses: input.windowTelemetry.jumpKeyPresses,
    platform_width_min_px: input.spawnParams.minWidth,
    platform_width_max_px: input.spawnParams.maxWidth,
    platform_width_avg_px: Math.round((input.spawnParams.minWidth + input.spawnParams.maxWidth) / 2),
    platform_height_min_px: input.spawnParams.minHeight,
    platform_height_max_px: input.spawnParams.maxHeight,
    platform_height_avg_px: Math.round((input.spawnParams.minHeight + input.spawnParams.maxHeight) / 2),
    platform_gap_y_min_px: input.spawnParams.minGapY,
    platform_gap_y_max_px: input.spawnParams.maxGapY,
    platform_gap_y_avg_px: Math.round((input.spawnParams.minGapY + input.spawnParams.maxGapY) / 2),
    platform_x_shift_min_px: input.spawnParams.minXShift,
    platform_x_shift_max_px: input.spawnParams.maxXShift,
    platform_speed_px_per_frame: Number(input.platformSpeed.toFixed(3)),
    flags_collected_total: input.flagsCollected,
    deaths_total: input.deathCount,
    seconds_since_flag: Number(input.latestTelemetry.secondsSinceFlag.toFixed(3)),
  }
}

const FLOWCLIMB_TELEMETRY_METHODS = {
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
  },

  clearStoredParticipantToken() {
    const storageKey = this.telemetryParticipantTokenStorageKey
    if (storageKey) {
      window.localStorage.removeItem(storageKey)
    }
  },

  handleTelemetryAccessDenied(error) {
    console.error("Telemetry access denied:", error?.message || error)
    this.clearStoredParticipantToken()
    this.blockAccess("Access token rejected", "Refresh and enter a valid access token.")
  },

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
      gameVersion: GAME_VERSION,
    }
  },

  resolveParticipantToken(globalConfig) {
    const storageKey = globalConfig.participantTokenStorageKey || globalConfig.storageKey || "flowclimb_participant_token"
    const existingToken = window.localStorage.getItem(storageKey)
    if (existingToken) {
      this.telemetryParticipantTokenStorageKey = storageKey
      this.telemetryParticipantTokenSource = "localStorage"
      return existingToken.trim().toLowerCase()
    }

    const token = window.prompt("Enter participant token")
    if (token) {
      const trimmedToken = token.trim().toLowerCase()
      window.localStorage.setItem(storageKey, trimmedToken)
      this.telemetryParticipantTokenStorageKey = storageKey
      this.telemetryParticipantTokenSource = "prompt"
      return trimmedToken
    }

    this.telemetryParticipantTokenStorageKey = storageKey
    this.telemetryParticipantTokenSource = "missing"
    return ""
  },

  maskToken(token) {
    if (!token) {
      return "<empty>"
    }

    if (token.length <= 8) {
      return `${token.slice(0, 2)}…${token.slice(-2)}`
    }

    return `${token.slice(0, 4)}…${token.slice(-4)}`
  },

  logTelemetry(type, value, extra = {}) {
    if (!this.telemetry || !this.telemetry.enabled) {
      return
    }

    if (type !== "telemetry_window") {
      return
    }

    this.telemetry.log(type, value, {
      ...extra,
      height_climbed: this.heightClimbed,
    })
  },

  logTelemetryWindow(latestTelemetry, previousDifficulty, predictedLabel, now) {
    this.flashUploadIcon()
    this.logTelemetry("telemetry_window", this.score, this.buildTelemetryWindowPayload(
      latestTelemetry,
      previousDifficulty,
      predictedLabel,
      now,
    ))
  },

  buildTelemetryWindowPayload(latestTelemetry, previousDifficulty, predictedLabel, now) {
    return buildFlowClimbTelemetryWindowPayload({
      telemetrySchemaVersion: TELEMETRY_SCHEMA_VERSION,
      telemetryWindowIndex: this.telemetryWindowIndex,
      windowTelemetry: this.windowTelemetry,
      windowEndTimestamp: now,
      gameModeLabel: this.gameModeLabel(),
      deploymentContext: this.currentDeploymentContext(),
      deviceType: this.currentDeviceType(),
      player: this.player,
      heightClimbed: this.heightClimbed,
      score: this.score,
      difficultyLevel: this.difficultyLevel,
      previousDifficulty,
      predictedLabel,
      skipReward: this.skipReward,
      spawnParams: this.currentSpawnParams(this.difficultyLevel),
      platformSpeed: this.movingPlatformSpeedForDifficulty(this.difficultyLevel),
      flagsCollected: this.flagsCollected,
      deathCount: this.deathCount,
      latestTelemetry,
    })
  },

  currentDeploymentContext() {
    const protocol = window.location?.protocol || ""
    const hostname = window.location?.hostname || ""
    const isLocal = protocol === "file:"
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || hostname === "[::]"
      || hostname === "0.0.0.0"
      || hostname.startsWith("192.168.")
      || hostname.startsWith("10.")
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    return isLocal ? "local" : "deployed"
  },

  currentDeviceType() {
    const coarsePointer = typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false
    const touchCapable = (navigator.maxTouchPoints || 0) > 0
    const narrowViewport = (window.innerWidth || SCREEN_WIDTH) < 900
    return (coarsePointer || (touchCapable && narrowViewport)) ? "mobile" : "desktop"
  },

  incrementWindowCounter(name, amount = 1) {
    if (this.windowTelemetry && Object.prototype.hasOwnProperty.call(this.windowTelemetry, name)) {
      this.windowTelemetry[name] += amount
    }
  },

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
  },

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
  },

  async flushTelemetry() {
    if (!this.telemetry || !this.telemetry.enabled) {
      return false
    }

    return this.telemetry.flush()
  },

  gameModeLabel() {
    if (this.gameMode !== FLOWCLIMB_MODES.FLOW) {
      return FLOWCLIMB_GAME_MODE_LABELS.TRAIN
    }
    return this.selectedFlowModel === FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX
      ? FLOWCLIMB_GAME_MODE_LABELS.FLOW_ML
      : FLOWCLIMB_GAME_MODE_LABELS.FLOW_HEURISTIC
  },

  getLatestTelemetryWindow(now) {
    return this.challengeFeatures(now)
  },

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
}

globalThis.FLOWCLIMB_TELEMETRY_METHODS = FLOWCLIMB_TELEMETRY_METHODS
