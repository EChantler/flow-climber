const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadTelemetry() {
  const context = {
    console: {
      ...console,
      error: () => {},
    },
    globalThis: {},
    window: {
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      visibilityState: 'visible',
    },
  }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync('telemetry.js', 'utf8'), context, { filename: 'telemetry.js' })
  return context
}

test('TelemetryManager buffers events with participant token and session metadata', async () => {
  const { TelemetryManager } = loadTelemetry()
  const inserted = []
  const supabase = {
    from(tableName) {
      assert.equal(tableName, 'telemetry')
      return {
        insert(rows) {
          inserted.push(...rows)
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  const telemetry = new TelemetryManager(supabase, 'token_01', {
    tableName: 'telemetry',
    sessionId: 'session_123',
    gameVersion: 'v0.9.0',
    batchSize: 99,
  })

  telemetry.log('telemetry_window', 42, {
    data_schema_version: 5,
    device_type: 'mobile',
    game_mode: 'flow-heuristic',
    window_index: 7,
    window_started_at: '2026-05-23T21:23:17.718Z',
    window_ended_at: '2026-05-23T21:23:27.718Z',
    difficulty: 5,
    score: 12,
    height_climbed: 345,
    challenge_label: 'appropriately_challenged',
    total_horizontal_movement_px: 99,
  })
  assert.equal(telemetry.buffer.length, 1)

  const accepted = await telemetry.flush()
  assert.equal(accepted, true)
  assert.equal(telemetry.buffer.length, 0)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].token_used, 'token_01')
  assert.equal(inserted[0].event_type, 'telemetry_window')
  assert.equal(inserted[0].metric_value, 42)
  assert.equal(inserted[0].game_version, 'v0.9.0')
  assert.equal(inserted[0].data_schema_version, 5)
  assert.equal(inserted[0].device_type, 'mobile')
  assert.equal(inserted[0].session_id, 'session_123')
  assert.equal(inserted[0].game_mode, 'flow-heuristic')
  assert.equal(inserted[0].window_index, 7)
  assert.equal(inserted[0].window_started_at, '2026-05-23T21:23:17.718Z')
  assert.equal(inserted[0].window_ended_at, '2026-05-23T21:23:27.718Z')
  assert.equal(inserted[0].difficulty, 5)
  assert.equal(inserted[0].score, 12)
  assert.equal(inserted[0].height_climbed, 345)
  assert.equal(inserted[0].challenge_label, 'appropriately_challenged')
  assert.equal(inserted[0].metadata.total_horizontal_movement_px, 99)
  assert.equal(inserted[0].metadata.session_id, undefined)
  assert.equal(inserted[0].metadata.data_schema_version, undefined)
  assert.equal(inserted[0].metadata.device_type, undefined)
  assert.equal(inserted[0].metadata.difficulty, undefined)
  assert.equal(inserted[0].metadata.score, undefined)
  assert.match(inserted[0].metadata.logged_at, /^\d{4}-\d{2}-\d{2}T/)
})

test('TelemetryManager restores buffer and disables on access-denied insert errors', async () => {
  const { TelemetryManager } = loadTelemetry()
  let accessDeniedError = null
  const supabase = {
    from() {
      return {
        insert() {
          return Promise.resolve({ error: { code: '42501', message: 'row-level security violation' } })
        },
      }
    },
  }

  const telemetry = new TelemetryManager(supabase, 'bad_token', {
    onAccessDenied: (error) => { accessDeniedError = error },
  })

  telemetry.log('telemetry_window', 1, {})
  const accepted = await telemetry.flush()
  assert.equal(accepted, false)
  assert.equal(telemetry.enabled, false)
  assert.equal(telemetry.buffer.length, 1)
  assert.equal(accessDeniedError.code, '42501')
})

test('createTelemetryManager is disabled when required config is missing', () => {
  const { createTelemetryManager } = loadTelemetry()
  const telemetry = createTelemetryManager({})
  assert.equal(telemetry.enabled, false)
})
