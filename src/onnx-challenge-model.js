const FLOWCLIMB_ONNX_MODEL_STATUS = {
  UNAVAILABLE: "unavailable",
  LOADING: "loading",
  READY: "ready",
  FAILED: "failed",
}

class FlowClimbOnnxChallengeModel {
  constructor(options = {}) {
    this.modelUrl = options.modelUrl || "./src/models/flow/logistic_regression.onnx"
    this.metadataUrl = options.metadataUrl || "./src/models/flow/logistic_regression.metadata.json"
    this.wasmPaths = options.wasmPaths || "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/"
    this.session = null
    this.metadata = null
    this.status = FLOWCLIMB_ONNX_MODEL_STATUS.UNAVAILABLE
    this.lastError = null
  }

  async load() {
    if (this.status === FLOWCLIMB_ONNX_MODEL_STATUS.READY || this.status === FLOWCLIMB_ONNX_MODEL_STATUS.LOADING) {
      return this.status === FLOWCLIMB_ONNX_MODEL_STATUS.READY
    }

    if (!globalThis.ort?.InferenceSession || !globalThis.ort?.Tensor) {
      this.status = FLOWCLIMB_ONNX_MODEL_STATUS.UNAVAILABLE
      this.lastError = "onnxruntime-web is not available"
      return false
    }

    this.status = FLOWCLIMB_ONNX_MODEL_STATUS.LOADING
    try {
      globalThis.ort.env.wasm.wasmPaths = this.wasmPaths
      const metadataResponse = await fetch(this.metadataUrl)
      if (!metadataResponse.ok) {
        throw new Error(`Could not load ONNX metadata: ${metadataResponse.status}`)
      }
      this.metadata = await metadataResponse.json()
      this.session = await globalThis.ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ["wasm"],
      })
      this.status = FLOWCLIMB_ONNX_MODEL_STATUS.READY
      return true
    } catch (error) {
      this.status = FLOWCLIMB_ONNX_MODEL_STATUS.FAILED
      this.lastError = error?.message || String(error)
      console.error("FlowClimb ONNX model unavailable", error)
      return false
    }
  }

  isReady() {
    return this.status === FLOWCLIMB_ONNX_MODEL_STATUS.READY && Boolean(this.session && this.metadata)
  }

  featureVector(features) {
    const values = {
      height_delta: features.heightDelta,
      flags_delta: features.flagsDelta,
      deaths_delta: features.deathsDelta,
      seconds_since_flag: features.secondsSinceFlag,
      difficulty: features.difficulty,
      interval_flags_per_minute: features.intervalFlagsPerMinute,
      interval_deaths_per_minute: features.intervalDeathsPerMinute,
    }
    return this.metadata.feature_columns.map((column) => Number(values[column] || 0))
  }

  async predict(features) {
    if (!this.isReady()) {
      return null
    }

    const inputName = this.session.inputNames[0]
    const output = await this.session.run({
      [inputName]: new globalThis.ort.Tensor("float32", Float32Array.from(this.featureVector(features)), [1, this.metadata.feature_columns.length]),
    })
    return this.labelFromOutput(output)
  }

  labelFromOutput(output) {
    const labelOutput = output.label?.data?.[0]
    if (typeof labelOutput === "string") {
      return labelOutput
    }
    if (typeof labelOutput === "number" || typeof labelOutput === "bigint") {
      return this.metadata.classes[Number(labelOutput)] || null
    }

    const probabilities = output.probabilities?.data
    if (probabilities?.length) {
      let bestIndex = 0
      for (let index = 1; index < probabilities.length; index += 1) {
        if (probabilities[index] > probabilities[bestIndex]) {
          bestIndex = index
        }
      }
      return this.metadata.classes[bestIndex] || null
    }

    return null
  }
}

function createFlowClimbOnnxChallengeModel(options = {}) {
  return new FlowClimbOnnxChallengeModel(options)
}

globalThis.FLOWCLIMB_ONNX_MODEL_STATUS = FLOWCLIMB_ONNX_MODEL_STATUS
globalThis.FlowClimbOnnxChallengeModel = FlowClimbOnnxChallengeModel
globalThis.createFlowClimbOnnxChallengeModel = createFlowClimbOnnxChallengeModel
