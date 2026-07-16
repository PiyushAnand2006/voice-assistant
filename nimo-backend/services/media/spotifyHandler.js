/**
 * services/media/spotifyHandler.js
 * Launches Spotify in a NEW browser window for the current platform.
 *
 *   openSpotify(query) → { success, query, service:'spotify', url, error? }
 *
 * Strategy:
 *   1. Build the Spotify web-search URL for the query.
 *   2. Delegate to browserLauncher which spawns Chrome/Edge/Firefox on the
 *      host OS with --new-window so a real system window opens.
 *   3. Works in both the Electron-wrapped and standalone HTTP server modes.
 */

const browserLauncher = require('../system/browserLauncher')
const logger = require('../../utils/logger')

/**
 * @param {string} query
 * @returns {Promise<{success:boolean, query:string, service:string, url:string, browser?:string, error?:string}>}
 */
async function openSpotify(query) {
  const q = String(query || '').trim()
  if (!q) return { success: false, query: '', service: 'spotify', url: '', error: 'Empty query.' }

  const url = `https://open.spotify.com/search/${encodeURIComponent(q)}`
  const result = await browserLauncher.openInBrowser(url)
  logger.info(`Spotify launched in ${result.browser || 'default browser'} for "${q}".`)
  return { success: result.success, query: q, service: 'spotify', url: result.url, browser: result.browser, error: result.error }
}

module.exports = { openSpotify }
