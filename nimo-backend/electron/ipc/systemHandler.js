/**
 * electron/ipc/systemHandler.js
 * IPC handlers for OS-level actions: volume, app launch, screenshot, timer,
 * time/date, weather.
 */

const { ipcMain } = require('electron')
const osDetect = require('../../utils/osDetect')
const logger = require('../../utils/logger')
const { format } = require('../../utils/errorHandler')
const constants = require('../../config/constants')

const appLauncher = require('../../services/system/appLauncher')
const volumeControl = require('../../services/system/volumeControl')
const screenshotter = require('../../services/system/screenshotter')
const timerManager = require('../../services/system/timerManager')

/** Attach outbound dispatcher so timer finishing pushes a UI event. */
function registerTimerDispatcher(mainWindow) {
  timerManager.setExternalDispatcher((payload) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('nimo:timer-done', payload)
      }
    } catch (err) {
      logger.error(`timer dispatch failed: ${err.message}`)
    }
  })
}

function currentTimeDate() {
  const now = new Date()
  return {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
}

function registerSystemHandlers(mainWindow) {
  registerTimerDispatcher(mainWindow)

  // ---------- Volume ----------
  ipcMain.handle('nimo:set-volume', async (_e, payload) => {
    try {
      const res = await volumeControl.control(payload || {})
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'VOLUME')
    }
  })

  // ---------- App Launcher ----------
  ipcMain.handle('nimo:open-app', async (_e, { appName } = {}) => {
    try {
      if (!appName) return format(new Error('No appName supplied.'), 'OPEN_APP')
      const res = await appLauncher.openApp(appName)
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'OPEN_APP')
    }
  })

  // ---------- Screenshot ----------
  ipcMain.handle('nimo:take-screenshot', async () => {
    try {
      const res = await screenshotter.takeScreenshot()
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'SCREENSHOT')
    }
  })

  // ---------- Timers ----------
  ipcMain.handle('nimo:set-timer', async (_e, { minutes, label } = {}) => {
    try {
      if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
        return format(new Error('Invalid minutes value.'), 'TIMER')
      }
      const res = timerManager.setTimer(minutes, label || 'Timer')
      if (!res) return format(new Error('Could not create timer.'), 'TIMER')
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'TIMER')
    }
  })

  ipcMain.handle('nimo:cancel-timer', async (_e, { id } = {}) => {
    try {
      const ok = timerManager.cancelTimer(id)
      return { ok: true, data: { cancelled: ok } }
    } catch (err) {
      return format(err, 'TIMER')
    }
  })

  ipcMain.handle('nimo:list-timers', async () => {
    try {
      return { ok: true, data: { timers: timerManager.listTimers() } }
    } catch (err) {
      return format(err, 'TIMER')
    }
  })

  // ---------- Time / Date ----------
  ipcMain.handle('nimo:get-time', async () => {
    try {
      return { ok: true, data: currentTimeDate() }
    } catch (err) {
      return format(err, 'TIME')
    }
  })

  // ---------- Weather (lightweight summary from OS) ----------
  ipcMain.handle('nimo:get-weather', async (_e, { city } = {}) => {
    try {
      const summary = await buildWeatherSummary(city)
      return { ok: true, data: { summary, city: city || null } }
    } catch (err) {
      return format(err, 'WEATHER')
    }
  })
}

/**
 * A minimal weather "summary" without an external API key:
 * opens a weather query in the user's browser and returns a short spoken line.
 * Pluggable: replace with a real API call later.
 */
async function buildWeatherSummary(city) {
  const loc = city ? `${encodeURIComponent(city)}` : encodeURIComponent('my location')
  const { shell } = require('electron')
  try {
    await shell.openExternal(`https://wttr.in/${loc}?format=3`)
    return city ? `Showing the weather for ${city}.` : 'Opening the weather for your location.'
  } catch {
    return "I couldn't fetch the weather right now."
  }
}

module.exports = {
  registerSystemHandlers,
  registerTimerDispatcher,
  currentTimeDate,
  constants: { VOLUME_STEP: constants.VOLUME_STEP }
}
