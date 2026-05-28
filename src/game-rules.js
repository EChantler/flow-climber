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
const SKIPPED_PLATFORM_REWARD = 2
const INITIAL_OBJECTIVE_PLATFORM_INDEX = 1

const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 10
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
const PLATFORMS_AHEAD_TO_KEEP = 5
const PLATFORM_WINDOW_SIZE = PLATFORMS_BEHIND_TO_KEEP + PLATFORMS_AHEAD_TO_KEEP
const CAMERA_FOLLOW_LERP = 0.08
const PLAYER_CAMERA_TARGET_SCREEN_Y = SCREEN_HEIGHT * 0.58
const FALL_BELOW_LOWEST_PLATFORM_MARGIN = 120
const MIN_PLATFORM_GAP_Y = Math.ceil(PLAYER_HEIGHT * 1.5)
const SPAWN_RANDOM_ATTEMPTS = 200
const DIFFICULTY_UPDATE_INTERVAL_MS = 10000
const FLOW_MODEL_UPDATE_INTERVAL_MS = 10000
const FLOW_DIFFICULTY_STEP = 1
const FLOW_MODEL_NAMES = [
  FLOWCLIMB_FLOW_MODELS.HEURISTIC,
  FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX,
]
const WORLD_ZOOM = 0.9

function predictFlowClimbHeuristicChallengeLabel(features) {
  const lowUpwardProgress = features.heightDelta < 200

  if (features.deathsDelta >= 2 && lowUpwardProgress) {
    return FLOWCLIMB_CHALLENGE_LABELS.OVER
  }
  if (features.deathsDelta <= 1 && !lowUpwardProgress) {
    return FLOWCLIMB_CHALLENGE_LABELS.UNDER
  }
  return FLOWCLIMB_CHALLENGE_LABELS.APPROPRIATE
}

const BACKGROUND_HEIGHT_STOPS = [
  { height: 0, color: 0x141a25 },
  { height: 500, color: 0x151d28 },
  { height: 1000, color: 0x16212c },
  { height: 1500, color: 0x162632 },
  { height: 2100, color: 0x152b37 },
  { height: 2800, color: 0x15313d },
  { height: 3600, color: 0x153748 },
  { height: 4500, color: 0x163a53 },
  { height: 5500, color: 0x1a3c60 },
  { height: 6700, color: 0x1f3c69 },
  { height: 8000, color: 0x2a3b6d },
  { height: 9500, color: 0x373873 },
  { height: 11200, color: 0x4a336f },
  { height: 13000, color: 0x5d2f64 },
  { height: 15000, color: 0x6b2f52 },
]

const FLOWCLIMB_DIFFICULTY_METHODS = {
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
  },

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
  },

  async bootstrapFlowModel() {
    const loadingTitle = "Loading Flow model"
    let dotCount = 1
    this.setAccessOverlay(`${loadingTitle}.`, "Preparing the study model.")
    const loadingAnimation = window.setInterval(() => {
      dotCount = dotCount % 3 + 1
      this.setAccessOverlay(`${loadingTitle}${".".repeat(dotCount)}`, "Preparing the study model.")
    }, 350)

    try {
      this.flowOnnxModelReady = await this.flowOnnxModel.load()
    } finally {
      window.clearInterval(loadingAnimation)
    }

    if (!this.flowOnnxModelReady) {
      const hint = window.location?.protocol === "file:"
        ? "ONNX models cannot load from file://. Serve the folder over http://localhost and try again."
        : "Please notify the developer and include this message."
      this.blockAccess("Flow model failed to load", hint)
      return false
    }
    return true
  }
}

globalThis.FLOWCLIMB_DIFFICULTY_METHODS = FLOWCLIMB_DIFFICULTY_METHODS
