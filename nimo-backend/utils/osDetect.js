/**
 * utils/osDetect.js
 * Cross-platform helper: returns the current OS family.
 */

const os = require('os')

/**
 * @returns {'win32'|'darwin'|'linux'}
 */
function getOS() {
  const platform = os.platform()
  if (platform === 'win32') return 'win32'
  if (platform === 'darwin') return 'darwin'
  // Treat everything else (linux, freebsd, etc.) as linux for our purposes.
  return 'linux'
}

/**
 * Human-readable OS name for logging / speech.
 */
function getOSName() {
  const map = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }
  return map[getOS()] || 'your system'
}

/**
 * Whether the platform has a graphical shell we can launch apps with.
 */
function hasGUI() {
  const osType = getOS()
  if (osType === 'win32' || osType === 'darwin') return true
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
}

module.exports = { getOS, getOSName, hasGUI }
