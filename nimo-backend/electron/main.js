/**
 * electron/main.js
 * Electron entry point. Builds a frameless, transparent, always-on-top
 * BrowserWindow, sets up the system tray, loads keystore config, and wires
 * every IPC handler.
 */

require('dotenv').config()

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')
const http = require('http')
const path = require('path')
const fs = require('fs')

const constants = require('../config/constants')
const { initKey } = require('../config/keystore')
const logger = require('../utils/logger')
const { registerAllIpc, dispatchIntent } = require('./ipc')
const { parseCommand } = require('../core/commandParser')
const { currentTimeDate } = require('./ipc/systemHandler')

// Refs we need to keep alive.
let mainWindow = null
let tray = null

// Decide UI source: dev server URL in dev, built ui/index.html in prod.
function resolveUiPath() {
  if (process.env.NODE_ENV === 'development') {
    return constants.DEV_SERVER_URL
  }
  return constants.UI_BUILD_PATH
}

// --- HTTP server for nimo-os proxy (port 3001) -----------------------

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

function startBackendHttpServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${constants.HTTP_SERVER_PORT}`)
    const pathname = url.pathname

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, '')
    }

    // Health check
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'nimo-backend', ts: Date.now() })
    }

    // POST /api/run-command  ← nimo-os proxies here
    if (req.method === 'POST' && pathname === '/api/run-command') {
      try {
        const body = await parseBody(req)
        const { transcript, personality } = body

        if (!transcript || !String(transcript).trim()) {
          return sendJson(res, 400, { ok: false, error: 'Transcript is empty' })
        }

        // Parse the transcript into { intent, params }
        const parsed = parseCommand(String(transcript))
        if (!parsed) {
          return sendJson(res, 200, {
            ok: true,
            action: 'unknown',
            result: '',
            speak: "I didn't catch that.",
            state: 'confused'
          })
        }

        // Dispatch to the full NIMO backend (all services + Claude AI).
        const envelope = await dispatchIntent(parsed.intent, parsed.params, mainWindow)

        return sendJson(res, 200, {
          ok: true,
          action: envelope.action || parsed.intent,
          result: envelope.result || '',
          speak: envelope.speak || '',
          state: envelope.state || 'idle',
          // passthrough fields nimo-os expects:
          openUrl: envelope.openUrl || undefined,
          timer: envelope.timer || undefined,
          stop: envelope.stop || false
        })
      } catch (err) {
        logger.error(`HTTP /api/run-command error: ${err.message}`)
        return sendJson(res, 200, {
          ok: false,
          action: 'error',
          result: err.message,
          speak: "Something went wrong on my end.",
          state: 'error'
        })
      }
    }

    // Unknown route
    res.writeHead(404, CORS_HEADERS)
    res.end(JSON.stringify({ ok: false, error: `No route ${req.method} ${pathname}` }))
  })

  server.on('error', (err) => {
    logger.error(`HTTP server error: ${err.message}`)
  })

  server.listen(constants.HTTP_SERVER_PORT, '127.0.0.1', () => {
    logger.info(`NIMO backend HTTP server listening on port ${constants.HTTP_SERVER_PORT}.`)
    logger.info(`nimo-os should proxy /api/run-command → http://localhost:${constants.HTTP_SERVER_PORT}/api/run-command`)
  })
}

async function bootstrap() {
  logger.info(`NIMO booting up. NODE_ENV=${process.env.NODE_ENV || 'production'}.`)
  await migrateApiKey()
}

// Migrate a Gemini API key in .env into the OS keychain on first launch.
async function migrateApiKey() {
  try {
    const key = await initKey()
    if (key) {
      process.env.GEMINI_API_KEY = key
      logger.info('Gemini API key resolved and set in process env.')
    }
  } catch (err) {
    logger.error(`Keystore migration failed: ${err.message}`)
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: constants.WINDOW_WIDTH,
    height: constants.WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  // Send config to the renderer once it's ready.
  mainWindow.webContents.on('did-finish-load', () => {
    const uiConfig = {
      WAKE_WORD: constants.WAKE_WORD,
      TTS_RATE: constants.TTS_RATE,
      TTS_PITCH: constants.TTS_PITCH,
      TTS_LANG: constants.TTS_LANG,
      DEFAULT_MUSIC_SERVICE: constants.DEFAULT_MUSIC_SERVICE,
      DEFAULT_SEARCH_ENGINE: constants.DEFAULT_SEARCH_ENGINE,
      AI_MODEL: constants.AI_MODEL
    }
    try {
      mainWindow.webContents.send('nimo:config', uiConfig)
    } catch (err) {
      logger.error(`config send failed: ${err.message}`)
    }
  })

  const uiPath = resolveUiPath()
  if (/^https?:\/\//i.test(uiPath)) {
    mainWindow.loadURL(uiPath)
  } else {
    const full = path.isAbsolute(uiPath) ? uiPath : path.join(process.cwd(), uiPath)
    if (fs.existsSync(full)) {
      mainWindow.loadFile(full)
    } else {
      logger.warn(`UI file not found at ${full}; loading a placeholder URL.`)
      mainWindow.loadURL('data:text/html,%3Ch1%20style%3D%22font-family%3Asans-serif%3Bcolor%3A%2300E8D6%3B%22%3ENIMO%20backend%20ready.%20Place%20UI%20at%20.&#47;ui&#47;index.html%3C&#47;h1%3E')
    }
  }

  // Always-on-top levels per platform (Windows needs screen-saver aware level).
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Allow the frameless window to be dragged via the renderer, and close.
  ipcMain.on('nimo:window-control', (_e, { action } = {}) => {
    if (!mainWindow) return
    if (action === 'hide') mainWindow.hide()
    else if (action === 'show') mainWindow.show()
    else if (action === 'quit') app.quit()
  })
}

function assertIconPath() {
  const candidates = ['icon.png', 'icon.ico', 'icon.icns']
  return candidates.map((c) => path.join(process.cwd(), 'assets', c)).find((p) => fs.existsSync(p)) || null
}

function createTray() {
  const iconPath = assertIconPath()
  let image = nativeImage.createEmpty()
  if (iconPath) {
    image = nativeImage.createFromPath(iconPath)
  } else {
    // 16x16 transparent-cyan square fallback so the tray still works.
    image = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9AAAAA6UlEQVR4AcXBQQ2CQABE0RPl' +
      'wcFBcHBwUFBQEBQcFAQUHAQUHBQcHBwUHBQcFBQUHBQUFBwcFBwcHAAAsAQXCAQEBAQEBA' +
      'QEBAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAAA' +
      'AAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQAAA' +
      'AAAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEB' +
      'AQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQ' +
      'EBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAA' +
      'AAAQEBAQEBAQEBAAAAAAQEBAQEBAQEBAAAAAAQEBAQEBAQEB',
      'base64'
    ))
  }
  try { tray = new Tray(image) } catch (err) {
    logger.warn(`Tray icon could not be created: ${err.message}`)
    return
  }
  tray.setToolTip('NIMO — voice assistant')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show NIMO', click: () => { if (mainWindow) mainWindow.show() } },
    { label: 'Hide NIMO', click: () => { if (mainWindow) mainWindow.hide() } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) mainWindow.hide()
    else mainWindow.show()
  })
}

// --- App lifecycle -----------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    await bootstrap()
    createMainWindow()
    createTray()
    try {
      registerAllIpc(mainWindow)
    } catch (err) {
      logger.error(`IPC registration failed: ${err.message}`)
    }

    // Start HTTP server for nimo-os proxy (port 3001).
    startBackendHttpServer()

    // macOS: re-create window on dock click.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    // Keep tray alive on all platforms; quit only on explicit Quit.
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    logger.info('NIMO shutting down.')
  })
}

module.exports = { registerAllIpc, createMainWindow, createTray, currentTimeDate }
