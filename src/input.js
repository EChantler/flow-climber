const FLOWCLIMB_INPUT_METHODS = {
  recordLeftPress() {
    this.incrementWindowCounter("leftKeyPresses")
  },

  recordRightPress() {
    this.incrementWindowCounter("rightKeyPresses")
  },

  recordJumpPress() {
    this.incrementWindowCounter("jumpKeyPresses")
  },

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
      q: false,
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
      "KeyQ",
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
  },

  setupTouchControls() {
    const bind = (element, handlers) => {
      if (!element) {
        return null
      }
  
      const onPointerDown = (event) => {
        event.preventDefault()
        element.setPointerCapture?.(event.pointerId)
        handlers.down?.(event)
      }
      const onPointerUp = (event) => {
        event.preventDefault()
        handlers.up?.(event)
      }
      const onPointerCancel = (event) => {
        event.preventDefault()
        handlers.cancel?.(event)
      }
  
      element.addEventListener("pointerdown", onPointerDown)
      element.addEventListener("pointerup", onPointerUp)
      element.addEventListener("pointercancel", onPointerCancel)
      element.addEventListener("pointerleave", onPointerCancel)
      element.addEventListener("contextmenu", (event) => event.preventDefault())
  
      return {
        element,
        onPointerDown,
        onPointerUp,
        onPointerCancel,
      }
    }
  
    this.touchControlBindings = [
      bind(document.getElementById("touch-left"), {
        down: () => {
          this.recordLeftPress()
          this.fallbackKeyState.left = true
          this.fallbackKeyState.right = false
        },
        up: () => {
          this.fallbackKeyState.left = false
        },
        cancel: () => {
          this.fallbackKeyState.left = false
        },
      }),
      bind(document.getElementById("touch-right"), {
        down: () => {
          this.recordRightPress()
          this.fallbackKeyState.right = true
          this.fallbackKeyState.left = false
        },
        up: () => {
          this.fallbackKeyState.right = false
        },
        cancel: () => {
          this.fallbackKeyState.right = false
        },
      }),
      bind(document.getElementById("touch-jump"), {
        down: () => {
          this.recordJumpPress()
          this.pendingActionPress.space = true
        },
      }),
      bind(document.getElementById("touch-pause"), {
        down: () => {
          this.pendingActionPress.p = true
        },
      }),
      bind(document.getElementById("touch-restart"), {
        down: () => {
          this.pendingActionPress.r = true
        },
      }),
      bind(document.getElementById("touch-menu"), {
        down: () => {
          this.pendingActionPress.q = true
        },
      }),
      bind(document.getElementById("touch-teleport"), {
        down: () => {
          this.pendingActionPress.u = true
        },
      }),
    ].filter(Boolean)
  },

  teardownTouchControls() {
    if (!this.touchControlBindings) {
      return
    }
  
    for (const binding of this.touchControlBindings) {
      binding.element.removeEventListener("pointerdown", binding.onPointerDown)
      binding.element.removeEventListener("pointerup", binding.onPointerUp)
      binding.element.removeEventListener("pointercancel", binding.onPointerCancel)
      binding.element.removeEventListener("pointerleave", binding.onPointerCancel)
    }
  
    this.touchControlBindings = []
  },

  updateFallbackKeyStateOnDown(code) {
    if (code === "ArrowLeft" || code === "KeyA") {
      this.recordLeftPress()
      this.fallbackKeyState.left = true
      this.fallbackKeyState.right = false
      return
    }
    if (code === "ArrowRight" || code === "KeyD") {
      this.recordRightPress()
      this.fallbackKeyState.right = true
      this.fallbackKeyState.left = false
      return
    }
    if (code === "Space") {
      this.recordJumpPress()
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
      return
    }
    if (code === "KeyQ") {
      this.pendingActionPress.q = true
    }
  },

  updateFallbackKeyStateOnUp(code) {
    if (code === "ArrowLeft" || code === "KeyA") {
      this.fallbackKeyState.left = false
      return
    }
    if (code === "ArrowRight" || code === "KeyD") {
      this.fallbackKeyState.right = false
    }
  },

  resetFallbackKeys() {
    this.fallbackKeyState.left = false
    this.fallbackKeyState.right = false
    this.pendingActionPress.space = false
    this.pendingActionPress.r = false
    this.pendingActionPress.u = false
    this.pendingActionPress.p = false
    this.pendingActionPress.q = false
  },

  isMoveLeftPressed() {
    return this.fallbackKeyState.left
  },

  isMoveRightPressed() {
    return this.fallbackKeyState.right
  },

  consumeActionPress(actionName) {
    const pressed = !!this.pendingActionPress[actionName]
    this.pendingActionPress[actionName] = false
    return pressed
  },

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
      Phaser.Input.Keyboard.KeyCodes.Q,
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
  },
}

globalThis.FLOWCLIMB_INPUT_METHODS = FLOWCLIMB_INPUT_METHODS
