/**
 * services/system/volumeControl.js
 * Cross-platform system volume control.
 *
 * Primary path: the `loudness` npm package (cross-platform).
 * Fallbacks (if loudness is unavailable):
 *   win32:  nircmd.exe setsysvolume  (0-65535 scale)
 *   darwin: osascript -e 'set volume output volume N' (0-100)
 *   linux:  amixer -D pulse sset Master N% (0-100)
 *
 * All public functions return scaled values 0-100 and an object
 * { level, device?, error? }.
 */

const { exec } = require('child_process')
const osDetect = require('../../utils/osDetect')
const constants = require('../../config/constants')
const logger = require('../../utils/logger')

const { VOLUME_STEP, VOLUME_MIN, VOLUME_MAX } = constants

let loudness = null
try {
  loudness = require('loudness')
} catch {
  loudness = null
  logger.warn('loudness package not available; using shell fallbacks for volume.')
}

function clamp(n) {
  return Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, Math.round(n)))
}

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 4000 }, (err, _stdout, _stderr) => resolve(!err))
  })
}

/**
 * Get the current system volume (0-100).
 */
async function getVolume() {
  if (loudness) {
    try {
      const level = await loudness.getVolume()
      return clamp(level)
    } catch (err) {
      logger.warn(`loudness.getVolume failed: ${err.message}; trying fallback.`)
    }
  }
  // Shell fallbacks cannot easily read volume; assume middle as last resort.
  return 50
}

/**
 * Set the system volume to an absolute level (0-100).
 */
async function setVolume(value) {
  const level = clamp(value)
  if (loudness) {
    try {
      await loudness.setVolume(level)
      logger.info(`volume set to ${level} via loudness.`)
      return level
    } catch (err) {
      logger.warn(`loudness.setVolume failed: ${err.message}; trying fallback.`)
    }
  }
  const platform = osDetect.getOS()
  let ok = false
  if (platform === 'win32') {
    // If nircmd is available it takes 0-65535.
    ok = await run(`nircmd.exe setsysvolume ${Math.round((level / VOLUME_MAX) * 65535)}`)
  } else if (platform === 'darwin') {
    ok = await run(`osascript -e 'set volume output volume ${level}'`)
  } else {
    ok = await run(`amixer -D pulse sset Master ${level}% > /dev/null 2>&1`)
  }
  if (!ok) logger.error('All volume set fallbacks failed.')
  return ok ? level : null
}

/**
 * Increase volume by VOLUME_STEP, clamped to 100.
 * @returns {Promise<number>} new level
 */
async function volumeUp() {
  const current = await getVolume()
  return setVolume(current + VOLUME_STEP)
}

/**
 * Decrease volume by VOLUME_STEP, clamped to 0.
 * @returns {Promise<number>} new level
 */
async function volumeDown() {
  const current = await getVolume()
  return setVolume(current - VOLUME_STEP)
}

/**
 * Unified dispatcher matching the IPC shape { direction, value? }.
 * @param {{direction:'up'|'down'|'set', value?:number}} payload
 * @returns {Promise<{level:number}>}
 */
async function control(payload) {
  if (!payload || !payload.direction) {
    return { level: await getVolume() }
  }
  let level
  switch (payload.direction) {
    case 'up':
      level = await volumeUp()
      break
    case 'down':
      level = await volumeDown()
      break
    case 'set':
      level = await setVolume(payload.value ?? 50)
      break
    default:
      level = await getVolume()
  }
  return { level: level == null ? await getVolume() : level }
}

module.exports = { control, getVolume, setVolume, volumeUp, volumeDown, clamp }
