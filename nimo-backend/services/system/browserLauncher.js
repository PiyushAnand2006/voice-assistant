/**
 * services/system/browserLauncher.js
 * Detects Chrome (and other browsers) on the host OS and opens a URL in a
 * brand-new external browser window.
 *
 *   openInBrowser(url)
 *     1. Discover Chrome, Edge, or Firefox on Windows/macOS/Linux.
 *     2. Spawn it with the URL using child_process.exec so we get a real
 *        OS-level "new browser window".
 *     3. If nothing is found, fall back to the OS default URL handler
 *        (cmd /c start "" <url> on Windows, `open <url>` on macOS,
 *         xdg-open on Linux).
 *
 * Returns: { success:boolean, url:string, browser?:string, error?:string }
 */

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const logger = require('../../utils/logger')

function fileExists(p) {
  try { return p && fs.existsSync(p) } catch { return false }
}

function isWindows() {
  return process.platform === 'win32'
}

/**
 * Extra Chrome CLI flags for a given launch context.
 * For music we force autoplay so a voice-triggered launch actually plays
 * (Chrome normally blocks autoplay without a user gesture).
 */
function chromeExtraFlags(opts = {}) {
  const flags = []
  if (opts.autoplay) {
    flags.push('--autoplay-policy=no-user-gesture-required', '--autoplay=1')
  }
  return flags
}

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 8000 }, (err) => {
      if (err) {
        logger.warn(`Browser launch failed: ${cmd} (${err.message})`)
        return resolve(false)
      }
      resolve(true)
    })
  })
}

/**
 * Locate Chrome / Edge / Firefox binaries for the current OS.
 * @returns {Array<{name:string, cmd:(url:string)=>string}>}
 */
function detectBrowsers() {
  const candidates = []
  if (isWindows()) {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`
    ].filter(fileExists)
    if (chromePaths.length) candidates.push({
      name: 'chrome',
      cmd: (url, extraFlags = []) => `start "" "${chromePaths[0]}" ${extraFlags.join(' ')} ${quoteWin(url)}`
    })

    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ].filter(fileExists)
    if (edgePaths.length) candidates.push({
      name: 'edge',
      cmd: (url) => `start "" "${edgePaths[0]}" ${quoteWin(url)}`
    })

    const firefoxPaths = [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
    ].filter(fileExists)
    if (firefoxPaths.length) candidates.push({
      name: 'firefox',
      cmd: (url) => `start "" "${firefoxPaths[0]}" -new-tab ${quoteWin(url)}`
    })
  } else if (process.platform === 'darwin') {
    if (fileExists('/Applications/Google Chrome.app')) candidates.push({
      name: 'chrome',
      cmd: (url, extraFlags = []) => `open -a "Google Chrome" ${quoteShell(url)} ${extraFlags.join(' ')}`
    })
    if (fileExists('/Applications/Google Chrome Canary.app')) candidates.push({
      name: 'chrome-canary',
      cmd: (url, extraFlags = []) => `open -a "Google Chrome Canary" ${quoteShell(url)} ${extraFlags.join(' ')}`
    })
    if (fileExists('/Applications/Microsoft Edge.app')) candidates.push({
      name: 'edge',
      cmd: (url) => `open -a "Microsoft Edge" ${quoteShell(url)}`
    })
    if (fileExists('/Applications/Firefox.app')) candidates.push({
      name: 'firefox',
      cmd: (url) => `open -a "Firefox" ${quoteShell(url)}`
    })
  } else {
    const candidatesLinux = [
      { name: 'google-chrome', cmd: (url, extraFlags = []) => `google-chrome ${extraFlags.join(' ')} ${quoteShell(url)}` },
      { name: 'chromium', cmd: (url, extraFlags = []) => `chromium ${extraFlags.join(' ')} ${quoteShell(url)}` },
      { name: 'chromium-browser', cmd: (url, extraFlags = []) => `chromium-browser ${extraFlags.join(' ')} ${quoteShell(url)}` },
      { name: 'microsoft-edge', cmd: (url) => `microsoft-edge ${quoteShell(url)}` },
      { name: 'firefox', cmd: (url) => `firefox -new-tab ${quoteShell(url)}` }
    ]
    for (const c of candidatesLinux) {
      try {
        if (execSyncSafe(`command -v ${c.name}`)) candidates.push(c)
      } catch { /* skip */ }
    }
  }
  return candidates
}

/** Quote a URL for Windows command line (escape interior double-quotes). */
function quoteWin(s) {
  return `"${String(s).replace(/"/g, '\\"')}"`
}

/** Quote a URL for POSIX command line. */
function quoteShell(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

function execSyncSafe(cmd) {
  try {
    const { execSync } = require('child_process')
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch { return false }
}

/**
 * Open the given URL on the host machine in a brand-new browser window.
 * @param {string} url
 * @param {{autoplay?:boolean}} [opts] Launch options (e.g. force autoplay for music).
 * @returns {Promise<{success:boolean, url:string, browser?:string, error?:string}>}
 */
async function openInBrowser(url, opts = {}) {
  const target = String(url || '').trim()
  if (!target) return { success: false, url: '', error: 'Empty URL.' }

  const extraChromeFlags = chromeExtraFlags(opts)

  const browsers = detectBrowsers()
  for (const b of browsers) {
    const cmd = b.name === 'chrome' || b.name === 'chrome-canary'
      ? b.cmd(target, extraChromeFlags)
      : b.cmd(target)
    logger.info(`Launching ${b.name}: ${cmd}`)
    const ok = await runCommand(cmd)
    if (ok) return { success: true, url: target, browser: b.name }
  }

  // Fallback: OS default handler.
  let fallback
  if (isWindows()) fallback = `start "" ${quoteWin(target)}`
  else if (process.platform === 'darwin') fallback = `open ${quoteShell(target)}`
  else fallback = `xdg-open ${quoteShell(target)}`

  logger.info(`Falling back to OS default: ${fallback}`)
  const ok = await runCommand(fallback)
  if (ok) return { success: true, url: target, browser: 'default' }

  return { success: false, url: target, error: 'No browser available to open the URL.' }
}

module.exports = { openInBrowser, detectBrowsers }
