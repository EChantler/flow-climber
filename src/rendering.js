const FLOWCLIMB_RENDERING_METHODS = {
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
  },

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
  },

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
  },

  worldToScreenX(worldX) {
    return (worldX * WORLD_ZOOM) + ((1 - WORLD_ZOOM) * SCREEN_WIDTH / 2)
  },

  worldToScreenY(worldY) {
    return ((worldY - Math.floor(this.cameraY)) * WORLD_ZOOM) + ((1 - WORLD_ZOOM) * SCREEN_HEIGHT / 2)
  },

  worldToScreenSize(value) {
    return Math.max(1, value * WORLD_ZOOM)
  },
}

globalThis.FLOWCLIMB_RENDERING_METHODS = FLOWCLIMB_RENDERING_METHODS
