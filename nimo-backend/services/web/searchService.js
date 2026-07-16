/**
 * services/web/searchService.js
 * Opens a web search URL for the query in a brand-new browser window.
 *
 *   openSearch(query, engine)
 *
 * Returns: { success, query, engine, url, browser?, error? }
 */

const browserLauncher = require('../system/browserLauncher')
const constants = require('../../config/constants')
const logger = require('../../utils/logger')

const SEARCH_URLS = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duck: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`
}

const DDG_HTML = 'https://html.duckduckgo.com/html/?q='
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/**
 * Fetch the raw HTML of a URL with a browser-like User-Agent.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchHtml(url) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

/**
 * Parse DuckDuckGo HTML results into a list of { title, url, snippet }.
 * @param {string} html
 * @param {number} [limit=5]
 */
function parseDdgResults(html, limit = 5) {
  const results = []
  // Each organic result lives in a block; titles use class "result__a".
  const blockRe = /<div class="result[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
  const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/

  const blocks = html.match(/<div class="result[\s\S]*?(?=<div class="result|<div class="results--main)/g) || []
  for (const block of blocks) {
    const t = block.match(titleRe)
    if (!t) continue
    const url = decodeDdgRedirect(t[1])
    const title = stripHtml(t[2]).trim()
    const s = block.match(snippetRe)
    const snippet = s ? stripHtml(s[1]).trim() : ''
    if (title && url) results.push({ title, url, snippet })
    if (results.length >= limit) break
  }
  return results
}

/** DuckDuckGo wraps external links in /l/?uddg=<encoded>. Decode them. */
function decodeDdgRedirect(href) {
  const m = href.match(/[?&]uddg=([^&]+)/)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { /* fall through */ }
  }
  return href
}

function stripHtml(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Perform a live web search: launches the browser AND returns parsed result
 * snippets so the UI can display them inline.
 *
 * @param {string} query
 * @param {('google'|'duck'|'bing')} [engine]
 * @returns {Promise<{success:boolean, query:string, engine:string, url:string, results:Array, browser?:string, error?:string}>}
 */
async function performSearch(query, engine) {
  const q = String(query || '').trim()
  if (!q) return { success: false, query: '', engine: engine || '', url: '', results: [], error: 'Empty query.' }

  const eng = (engine && SEARCH_URLS[engine])
    ? engine
    : (constants.DEFAULT_SEARCH_ENGINE && SEARCH_URLS[constants.DEFAULT_SEARCH_ENGINE] ? constants.DEFAULT_SEARCH_ENGINE : 'google')
  const urlBuilder = SEARCH_URLS[eng]
  if (!urlBuilder) {
    return { success: false, query: q, engine: eng, url: '', results: [], error: `Unknown search engine: ${engine}.` }
  }

  const url = urlBuilder(q)
  const launch = await browserLauncher.openInBrowser(url)
  logger.info(`Web search (${eng}) launched in ${launch.browser || 'default browser'} for "${q}".`)

  // Fetch live result snippets for inline display.
  let results = []
  try {
    const html = await fetchHtml(DDG_HTML + encodeURIComponent(q))
    results = parseDdgResults(html, 5)
  } catch (e) {
    logger.warn(`Live result fetch failed for "${q}": ${e.message}`)
  }

  return {
    success: launch.success,
    query: q,
    engine: eng,
    url: launch.url,
    results,
    browser: launch.browser,
    error: launch.error
  }
}

/**
 * @param {string} query
 * @param {('google'|'duck'|'bing')} [engine]
 */
async function openSearch(query, engine) {
  const r = await performSearch(query, engine)
  // Keep the legacy shape for any old callers.
  return { success: r.success, query: r.query, engine: r.engine, url: r.url, browser: r.browser, error: r.error }
}

/**
 * Open a Google Images search for the query in a brand-new browser window.
 * @param {string} query
 */
async function openImageSearch(query) {
  const q = String(query || '').trim()
  if (!q) return { success: false, query: '', url: '', error: 'Empty query.' }
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`
  const result = await browserLauncher.openInBrowser(url)
  logger.info(`Image search launched in ${result.browser || 'default browser'} for "${q}".`)
  return { success: result.success, query: q, engine: 'google-images', url: result.url, browser: result.browser, error: result.error }
}

module.exports = { openSearch, openImageSearch, performSearch, parseDdgResults, SEARCH_URLS }
