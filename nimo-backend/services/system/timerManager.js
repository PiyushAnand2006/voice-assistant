/**
 * services/system/timerManager.js
 * Lightweight in-memory timer/alarm manager.
 *
 *   setTimer(minutes, label) → { id, label, minutes }
 *   cancelTimer(id)          → boolean
 *   listTimers()             → [{ id, label, minutes, remainingMs }]
 *
 * When a timer fires, it:
 *   - sends 'nimo:timer-done' to the main window (if registered) via a settable
 *     callback, and
 *   - shows an OS Notification.
 *
 * The Renderer pushes the IPC callback downward via setExternalDispatcher()
 * so this service stays Electron-agnostic and unit-testable.
 */

const { Notification } = require('electron')
const logger = require('../../utils/logger')

/** Map<id, { id, label, minutes, timeout, startedAt }> */
const timers = new Map()

let externalDispatcher = null
/**
 * Register a function to be called when a timer finishes, e.g.
 *   setExternalDispatcher((payload) => mainWindow.webContents.send('nimo:timer-done', payload))
 */
function setExternalDispatcher(fn) {
  externalDispatcher = typeof fn === 'function' ? fn : null
}

/**
 * Set a countdown timer.
 * @param {number} minutes Timer duration in minutes (may be fractional).
 * @param {string} [label='Timer'] Optional label.
 * @returns {{ id:string, label:string, minutes:number }}
 */
function setTimer(minutes, label = 'Timer') {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) {
    logger.warn(`setTimer ignored invalid minutes: ${minutes}`)
    return null
  }

  const id = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  const durationMs = m * 60 * 1000

  const timeout = setTimeout(() => {
    const payload = { id, label, minutes: m }
    try {
      new Notification({ title: 'NIMO Timer', body: `${label} is done!` }).show()
    } catch (err) {
      logger.error(`timerManager Notification failed: ${err.message}`)
    }
    try {
      if (externalDispatcher) externalDispatcher(payload)
    } catch (err) {
      logger.error(`timerManager dispatcher failed: ${err.message}`)
    }
    timers.delete(id)
    logger.info(`Timer ${id} (${label}) fired.`)
  }, durationMs)

  timers.set(id, { id, label, minutes: m, timeout, startedAt: Date.now() })
  logger.info(`Timer set: ${id} ${label} ${m} min.`)
  return { id, label, minutes: m }
}

/**
 * Cancel a timer by id.
 * @param {string} id
 * @returns {boolean}
 */
function cancelTimer(id) {
  const t = timers.get(id)
  if (!t) return false
  clearTimeout(t.timeout)
  timers.delete(id)
  logger.info(`Timer ${id} cancelled.`)
  return true
}

/**
 * Cancel all active timers.
 */
function cancelAll() {
  for (const [, t] of timers) clearTimeout(t.timeout)
  timers.clear()
  logger.info('All timers cleared.')
}

/**
 * List active timers with remaining milliseconds.
 * @returns {Array<{id:string,label:string,minutes:number,remainingMs:number}>}
 */
function listTimers() {
  const now = Date.now()
  return [...timers.values()].map((t) => ({
    id: t.id,
    label: t.label,
    minutes: t.minutes,
    remainingMs: Math.max(0, t.startedAt + t.minutes * 60 * 1000 - now)
  }))
}

module.exports = { setExternalDispatcher, setTimer, cancelTimer, cancelAll, listTimers }
