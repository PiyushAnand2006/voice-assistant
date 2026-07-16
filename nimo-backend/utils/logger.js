/**
 * utils/logger.js
 * Minimal leveled file logger. Writes to <app>/logs/nimo.log
 */

const fs = require('fs')
const path = require('path')
const constants = require('../config/constants')

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const CURRENT_LEVEL = LOG_LEVELS[constants.LOG_LEVEL] || LOG_LEVELS.info

let logFilePath = null

function ensureLogStream() {
  if (logFilePath) return logFilePath
  try {
    const dir = path.resolve(process.cwd(), constants.LOG_DIR)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    logFilePath = path.join(dir, 'nimo.log')
  } catch {
    logFilePath = path.join(require('os').tmpdir(), 'nimo.log')
  }
  return logFilePath
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '')
}

function write(level, msg) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${msg}\n`
  try {
    fs.appendFileSync(ensureLogStream(), line, { flag: 'a' })
  } catch {
    // If file logging fails, fall back to console silently.
  }
  if (process.env.NODE_ENV !== 'production') {
    // also surface to stdout for dev visibility
    // eslint-disable-next-line no-console
    console.log(line.trimEnd())
  }
}

module.exports = {
  debug: (m) => write('debug', m),
  info: (m) => write('info', m),
  warn: (m) => write('warn', m),
  error: (m) => write('error', m),
  child: (_tag) => module.exports // passthrough for compatibility
}
