/**
 * nimo-backend/server.js
 * Standalone localhost HTTP server (NO Electron).
 *
 * Exposes:
 *   GET  /api/health
 *   POST /api/run-command  { transcript, personality? }
 *
 * The nimo-os UI (port 3000) proxies its /api/run-command here.
 *
 * Run with:  node server.js
 */

require('dotenv').config()

const http = require('http')
const path = require('path')

const constants = require('./config/constants')
const { initKey } = require('./config/keystore')
const logger = require('./utils/logger')
const { parseCommand } = require('./core/commandParser')
const { dispatchIntent } = require('./electron/ipc')
const elevenLabsTts = require('./services/tts/elevenLabsTts')

const PORT = constants.HTTP_SERVER_PORT || 3001

// ── Helpers ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS })
  res.end(JSON.stringify(data))
}

// ── HTTP server ──────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, '')
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'nimo-backend', ts: Date.now() })
  }

  if (req.method === 'POST' && pathname === '/api/run-command') {
    try {
      const body = await parseBody(req)
      const { transcript, personality, intent } = body
      logger.info(`[RUN-COMMAND] transcript="${transcript}" personality="${personality}"`)

      if (!transcript || !String(transcript).trim()) {
        return sendJson(res, 400, { ok: false, error: 'Transcript is empty' })
      }

      const parsed = parseCommand(String(transcript), { intent })
      if (!parsed) {
        return sendJson(res, 200, {
          ok: true,
          action: 'unknown',
          result: '',
          speak: "I didn't catch that.",
          state: 'confused'
        })
      }

      // mainWindow = null (no Electron renderer in plain-server mode).
      const envelope = await dispatchIntent(parsed.intent, parsed.params, null)

      return sendJson(res, 200, {
        ok: true,
        action: envelope.action || parsed.intent,
        result: envelope.result || '',
        speak: envelope.speak || '',
        state: envelope.state || 'idle',
        openUrl: envelope.openUrl || undefined,
        timer: envelope.timer || undefined,
        stop: envelope.stop || false
      })
    } catch (err) {
      logger.error(`/api/run-command error: ${err.message}`)
      return sendJson(res, 200, {
        ok: false,
        action: 'error',
        result: err.message,
        speak: "Something went wrong on my end.",
        state: 'error'
      })
    }
  }

  if (req.method === 'POST' && pathname === '/api/tts') {
    try {
      const body = await parseBody(req)
      const { text, opts } = body

      if (!text || !String(text).trim()) {
        return sendJson(res, 400, { ok: false, error: 'Text is empty' })
      }

      const data = await elevenLabsTts.synthesize(String(text), opts || {})
      return sendJson(res, 200, { ok: true, data })
    } catch (err) {
      logger.error(`/api/tts error: ${err.message}`)
      return sendJson(res, 500, { ok: false, error: err.message })
    }
  }

  res.writeHead(404, CORS_HEADERS)
  res.end(JSON.stringify({ ok: false, error: `No route ${req.method} ${pathname}` }))
})

server.on('error', (err) => {
  logger.error(`HTTP server error: ${err.message}`)
  process.exit(1)
})

// ── Bootstrap ───────────────────────────────────────────────────────────────

;(async () => {
  try {
    const key = await initKey()
    if (key) {
      process.env.GEMINI_API_KEY = key
      logger.info('Gemini API key resolved and set in process env.')
    }
  } catch (err) {
    logger.error(`Keystore migration failed: ${err.message}`)
  }

  server.listen(PORT, '127.0.0.1', () => {
    logger.info(`NIMO backend HTTP server listening on http://localhost:${PORT}`)
    logger.info(`nimo-os should proxy /api/run-command → http://localhost:${PORT}/api/run-command`)
  })
})()

module.exports = server