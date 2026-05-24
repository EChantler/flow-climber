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
    batchSize: 99,
  })

  telemetry.log('telemetry_window', 42, { difficulty: 5 })
  assert.equal(telemetry.buffer.length, 1)

  const accepted = await telemetry.flush()
  assert.equal(accepted, true)
  assert.equal(telemetry.buffer.length, 0)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].token_used, 'token_01')
  assert.equal(inserted[0].event_type, 'telemetry_window')
  assert.equal(inserted[0].metric_value, 42)
  assert.equal(inserted[0].metadata.session_id, 'session_123')
  assert.equal(inserted[0].metadata.difficulty, 5)
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
