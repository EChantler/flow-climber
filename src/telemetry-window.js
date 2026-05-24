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

globalThis.buildFlowClimbTelemetryWindowPayload = buildFlowClimbTelemetryWindowPayload
