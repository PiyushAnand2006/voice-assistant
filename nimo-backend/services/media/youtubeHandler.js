/**
 * services/media/youtubeHandler.js
 * Launches YouTube in a NEW browser window for the current platform.
 *
 *   openYouTube(query)        → launches the YouTube search results for `query`
 *   openYouTubeHome()         → launches https://www.youtube.com
 *   buildSearchUrl(query)    → helper to compose the search URL
 */

const browserLauncher = require('../system/browserLauncher')
const logger = require('../../utils/logger')

/**
 * Build a YouTube URL for `query`.
 *
 * We use the standard search-results page (not the /embed player) because the
 * embed `listType=search` endpoint returns a "Video configuration error" when
 * opened as a standalone browser tab. The results page always loads and shows
 * the top matching video; combined with the autoplay Chrome flag the first
 * result will start playing.
 *
 * @param {string} query
 * @returns {string}
 */
function buildSearchUrl(query) {
  const q = String(query || '').trim()
  // Search-results page (reliable to open in a real browser tab).
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/**
 * Open the YouTube home page in a brand-new browser window.
 */
async function openYouTubeHome() {
  const url = 'https://www.youtube.com'
  const result = await browserLauncher.openInBrowser(url)
  logger.info(`YouTube launched in ${result.browser || 'default browser'}.`)
  return { success: result.success, query: '', service: 'youtube', url: result.url, browser: result.browser, error: result.error }
}

/**
 * Open a YouTube search for `query` in a brand-new browser window.
 * @param {string} query
 */
async function openYouTube(query) {
  const q = String(query || '').trim()
  if (!q) return openYouTubeHome()
  const url = buildSearchUrl(q)
  // Force autoplay so a voice-triggered launch actually starts playback.
  const result = await browserLauncher.openInBrowser(url, { autoplay: true })
  logger.info(`YouTube launched in ${result.browser || 'default browser'} for "${q}".`)
  return { success: result.success, query: q, service: 'youtube', url: result.url, browser: result.browser, error: result.error }
}

module.exports = { openYouTube, openYouTubeHome, buildSearchUrl }
