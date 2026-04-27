class TelemetryManager {
  constructor(supabaseClient, participantToken, options = {}) {
    this.supabase = supabaseClient
    this.participantToken = participantToken
    this.tableName = options.tableName || "telemetry"
    this.batchSize = options.batchSize || 12
    this.flushIntervalMs = options.flushIntervalMs || 15000
    this.sessionId = options.sessionId || null
    this.enabled = !!(this.supabase && this.participantToken)
    this.buffer = []
    this.flushTimer = null
    this.boundVisibilityHandler = null
    this.boundPageHideHandler = null
  }

  start() {
    if (!this.enabled || this.flushTimer) {
      return
    }

    this.flushTimer = window.setInterval(() => {
      this.flush().catch((error) => {
        console.error("Telemetry flush failed:", error)
      })
    }, this.flushIntervalMs)

    this.boundVisibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        void this.flush()
      }
    }

    this.boundPageHideHandler = () => {
      void this.flush()
    }

    document.addEventListener("visibilitychange", this.boundVisibilityHandler)
    window.addEventListener("pagehide", this.boundPageHideHandler)
  }

  stop() {
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    if (this.boundVisibilityHandler) {
      document.removeEventListener("visibilitychange", this.boundVisibilityHandler)
      this.boundVisibilityHandler = null
    }

    if (this.boundPageHideHandler) {
      window.removeEventListener("pagehide", this.boundPageHideHandler)
      this.boundPageHideHandler = null
    }
  }

  log(type, value, extra = {}) {
    if (!this.enabled) {
      return
    }

    this.buffer.push({
      token_used: this.participantToken,
      event_type: type,
      metric_value: value,
      metadata: {
        ...extra,
        session_id: this.sessionId,
        logged_at: new Date().toISOString(),
      },
    })

    if (this.buffer.length >= this.batchSize) {
      void this.flush()
    }
  }

  async flush() {
    if (!this.enabled || this.buffer.length === 0) {
      return
    }

    const dataToSend = [...this.buffer]
    this.buffer = []

    const { error } = await this.supabase
      .from(this.tableName)
      .insert(dataToSend, { returning: "minimal" })

    if (error) {
      console.error("Telemetry flush failed:", error.message)
      this.buffer = [...dataToSend, ...this.buffer]
    }
  }
}

function createTelemetryManager(config = {}) {
  const supabaseUrl = config.supabaseUrl || ""
  const supabaseAnonKey = config.supabaseAnonKey || ""
  const participantToken = config.participantToken || ""
  const createClient = globalThis.supabase?.createClient

  if (!supabaseUrl || !supabaseAnonKey || !participantToken || typeof createClient !== "function") {
    return new TelemetryManager(null, "", { enabled: false })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  return new TelemetryManager(supabase, participantToken, config)
}

globalThis.TelemetryManager = TelemetryManager
globalThis.createTelemetryManager = createTelemetryManager
