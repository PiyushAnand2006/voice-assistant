/**
 * utils/errorHandler.js
 * Centralized error formatter. Normalizes thrown values / rejected promises
 * into a consistent { ok, error, code, speakable } shape that the IPC layer
 * can forward to the renderer.
 */

const logger = require('./logger')

/**
 * @typedef {Object} NimoError
 * @property {boolean} ok      - false for errors
 * @property {string}  error   - short error message
 * @property {string}  code    - machine-readable code
 * @property {string}  speak   - user-friendly TTS text
 * @property {string}  state    - UI state to show
 */

class NimoError extends Error {
  constructor(code, message, speak, state = 'error') {
    super(message)
    this.code = code
    this.speak = speak || message
    this.state = state
  }
}

/**
 * Format any thrown thing into a NimoError-like object.
 * @param {Error|string|Object} err
 * @param {string} [fallbackCode='UNKNOWN']
 * @returns {NimoError}
 */
function format(err, fallbackCode = 'UNKNOWN') {
  if (err instanceof NimoError) {
    logger.error(`[${err.code}] ${err.message}`)
    return {
      ok: false,
      error: err.message,
      code: err.code,
      speak: err.speak,
      state: err.state
    }
  }
  if (err instanceof Error) {
    logger.error(`${err.name}: ${err.message}`)
    return {
      ok: false,
      error: err.message,
      code: fallbackCode,
      speak: spellableError(err.message),
      state: 'error'
    }
  }
  if (typeof err === 'string') {
    logger.error(err)
    return {
      ok: false,
      error: err,
      code: fallbackCode,
      speak: spellableError(err),
      state: 'error'
    }
  }
  logger.error(JSON.stringify(err))
  return {
    ok: false,
    error: 'An unexpected error occurred.',
    code: fallbackCode,
    speak: "Hmm, something went wrong on my end.",
    state: 'error'
  }
}

/**
 * Wrap an async function so it never throws — it always resolves to either
 * { ok: true, data } or a NimoError shape. Handy inside IPC handlers.
 */
function guard(fn, code = 'UNKNOWN') {
  return async (...args) => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      return format(err, code)
    }
  }
}

// Trim noisy paths / stack noise from a raw message for TTS.
function spellableError(msg) {
  if (!msg) return "Something went wrong."
  let s = String(msg).split('\n')[0]
  s = s.replace(/[A-Za-z]:[\\\/][^\s]+/g, 'a system path').replace(/\s+/g, ' ').trim()
  if (s.length > 120) s = s.slice(0, 117) + '...'
  return s
}

module.exports = { NimoError, format, guard, spellableError }
