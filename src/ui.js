const FLOWCLIMB_UI_METHODS = {
  createMenuScreen() {
    const title = this.add.text(SCREEN_WIDTH / 2, 118, "FlowClimb", {
      fontSize: "62px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5)

    const notice = this.add.text(
      SCREEN_WIDTH / 2,
      210,
      "\n\nData collection notice\nThis study build records gameplay telemetry (mode, score, flags, deaths, height, difficulty and model decisions) using your participant token.\nNo personally identifiable information is collected. Telemetry is used to evaluate and improve the adaptive difficulty system. By participating, you consent to this data collection.",
      {
        fontSize: "14px",
        color: "#d6deea",
        align: "center",
        wordWrap: { width: 590 },
        lineSpacing: 8,
      },
    ).setOrigin(0.5)

    const makeButton = (y, label, mode, options = {}) => {
      const enabled = options.enabled !== false
      const button = this.add.text(SCREEN_WIDTH / 2, y, label, {
        fontSize: "28px",
        color: enabled ? "#ffffff" : "#9ca8b8",
        backgroundColor: enabled ? "rgba(55, 83, 126, 0.82)" : "rgba(55, 83, 126, 0.32)",
        padding: { x: 28, y: 14 },
      }).setOrigin(0.5)
      button.menuEnabled = enabled
      if (enabled) {
        button.setInteractive({ useHandCursor: true })
        button.on("pointerdown", () => {
          if (mode === FLOWCLIMB_MODES.TRAIN) {
            this.showTrainModeIntro()
          } else {
            this.startRun(mode)
          }
        })
        button.on("pointerover", () => button.setStyle({ backgroundColor: "rgba(77, 112, 168, 0.96)" }))
        button.on("pointerout", () => button.setStyle({ backgroundColor: "rgba(55, 83, 126, 0.82)" }))
      }
      return button
    }

    const trainButton = makeButton(390, "Train mode — locked", FLOWCLIMB_MODES.TRAIN, { enabled: false })
    const flowButton = makeButton(470, "Flow mode", FLOWCLIMB_MODES.FLOW)
    this.menuButtons = [trainButton, flowButton]
    const hint = this.add.text(SCREEN_WIDTH / 2, 552, "Train mode is locked. Flow mode uses the active adaptive difficulty model.", {
      fontSize: "16px",
      color: "#93a4bd",
      align: "center",
      wordWrap: { width: 560 },
    }).setOrigin(0.5)

    this.menuTexts = [title, notice, trainButton, flowButton, hint]

    const trainIntroTitle = this.add.text(SCREEN_WIDTH / 2, 140, "Train mode", {
      fontSize: "46px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5)
    const trainIntroBody = this.add.text(
      SCREEN_WIDTH / 2,
      306,
      "\n\nTrain mode collects gameplay data for the FlowClimb experiment.\n\nThe run will get more difficult over time. Play for as long as you like.\n\nIf it becomes too difficult, you can restart the run. It would be appreciated if you play a couple of rounds for the sake of the study.",
      {
        fontSize: "22px",
        color: "#d6deea",
        align: "center",
        wordWrap: { width: 590 },
        lineSpacing: 10,
      },
    ).setOrigin(0.5)
    const trainIntroStartButton = this.add.text(SCREEN_WIDTH / 2, 540, "Start train run", {
      fontSize: "28px",
      color: "#ffffff",
      backgroundColor: "rgba(55, 83, 126, 0.82)",
      padding: { x: 28, y: 14 },
    }).setOrigin(0.5)
    trainIntroStartButton.setInteractive({ useHandCursor: true })
    trainIntroStartButton.on("pointerdown", () => this.startRun(FLOWCLIMB_MODES.TRAIN))
    trainIntroStartButton.on("pointerover", () => trainIntroStartButton.setStyle({ backgroundColor: "rgba(77, 112, 168, 0.96)" }))
    trainIntroStartButton.on("pointerout", () => trainIntroStartButton.setStyle({ backgroundColor: "rgba(55, 83, 126, 0.82)" }))
    const trainIntroBackButton = this.add.text(SCREEN_WIDTH / 2, 624, "Back to menu", {
      fontSize: "20px",
      color: "#d6deea",
      backgroundColor: "rgba(55, 83, 126, 0.45)",
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5)
    trainIntroBackButton.setInteractive({ useHandCursor: true })
    trainIntroBackButton.on("pointerdown", () => this.showMenu())
    this.trainIntroTexts = [trainIntroTitle, trainIntroBody, trainIntroStartButton, trainIntroBackButton]
    this.setTrainIntroVisible(false)
  },

  setMenuVisible(visible) {
    if (this.menuTexts) {
      this.menuTexts.forEach((text) => text.setVisible(visible))
    }
    if (this.menuButtons) {
      this.menuButtons.forEach((button) => {
        if (visible && button.menuEnabled) {
          button.setInteractive({ useHandCursor: true })
        } else {
          button.disableInteractive()
        }
      })
    }
  },

  setTrainIntroVisible(visible) {
    if (this.trainIntroTexts) {
      this.trainIntroTexts.forEach((text) => text.setVisible(visible))
    }
  },

  showTrainModeIntro() {
    this.screenState = "mode_intro"
    this.resetFallbackKeys()
    this.setMenuVisible(false)
    this.setHudVisible(false)
    this.setTouchControlsVisible(false)
    this.setTrainIntroVisible(true)
    this.drawMenuBackground()
  },

  setHudVisible(visible) {
    this.hudTexts.forEach((text) => text.setVisible(visible))
  },

  setTouchControlsVisible(visible) {
    const controls = document.getElementById("touch-controls")
    if (controls) {
      controls.style.visibility = visible ? "visible" : "hidden"
    }
    if (!visible) {
      this.setTouchTeleportVisible(false)
    }
  },

  setTouchTeleportVisible(visible) {
    const teleportButton = document.getElementById("touch-teleport")
    if (teleportButton) {
      teleportButton.hidden = !visible
    }
  },

  showMenu() {
    this.resetSessionId()
    this.screenState = "menu"
    this.gameMode = null
    this.selectedFlowModel = null
    this.isPaused = false
    this.resetFallbackKeys()
    this.setHudVisible(false)
    this.setTouchControlsVisible(false)
    this.pauseOverlay.setVisible(false)
    this.pauseOverlayHint.setVisible(false)
    this.unstuckOverlay.setVisible(false)
    this.setTouchTeleportVisible(false)
    this.uploadIcon.setVisible(false)
    this.setTrainIntroVisible(false)
    this.setMenuVisible(true)
    this.drawMenuBackground()
  },

  drawMenuBackground() {
    this.graphics.clear()
    this.graphics.fillStyle(0x141a25, 1)
    this.graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  },

  setAccessOverlay(title, hint) {
    this.accessOverlay.setText(title)
    this.accessOverlayHint.setText(hint)
    this.accessOverlay.setVisible(true)
    this.accessOverlayHint.setVisible(!!hint)
  },

  blockAccess(title, hint) {
    this.accessBlocked = true
    this.gameReady = false
    this.isPaused = false
    this.telemetry?.stop()
    this.setAccessOverlay(title, hint)
    if (this.platforms && this.player) {
      this.drawWorld()
    }
  },

  flashUploadIcon() {
    if (!this.uploadIcon) {
      return
    }

    if (this.uploadIconTimer) {
      this.uploadIconTimer.remove(false)
    }

    this.uploadIcon.setVisible(true)
    this.uploadIconTimer = this.time.delayedCall(100, () => {
      this.uploadIcon.setVisible(false)
      this.uploadIconTimer = null
    })
  },

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
  },

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
  },

  flowModelDisplayName() {
    if (this.selectedFlowModel !== FLOWCLIMB_FLOW_MODELS.PROMOTED_ONNX) {
      return this.selectedFlowModel || "none"
    }
    return this.flowOnnxModel?.metadata?.promoted_model_name
      || this.flowOnnxModel?.metadata?.model_name
      || "active_onnx"
  }
}

globalThis.FLOWCLIMB_UI_METHODS = FLOWCLIMB_UI_METHODS
