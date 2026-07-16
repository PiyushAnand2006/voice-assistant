/**
 * core/responseBuilder.js
 * Formats service results into the { action, result, speak, state } envelope
 * the IPC layer sends back to the renderer UI.
 *
 * The `speak` field is what the UI will pass to the TTS synthesizer.
 * `state` is one of: 'idle' | 'listening' | 'thinking' | 'talking' | 'happy' |
 * 'confused' | 'error' | 'music' — mapped to a facial expression by the UI.
 */

const osDetect = require('../utils/osDetect')
const constants = require('../config/constants')

/**
 * Build a standard response envelope.
 * @param {string} action   Machine action name, e.g. 'open_app'.
 * @param {object} result   Raw service result data.
 * @param {string} speak    TTS-friendly text.
 * @param {string} [state='idle'] UI emotional state.
 */
function build(action, result, speak, state = 'idle', extra = {}) {
  return { action, result, speak, state, ...extra }
}

// --- Speech templates -------------------------------------------------

const phrases = {
  open_app_ok: (name) => `Opening ${name}.`,
  open_app_fail: (name) => `I couldn't open ${name}.`,
  open_app_search: (name) => `I couldn't find ${name} on this device, but I've opened a Google search for it.`,

  music_ok: (query, service) => `Playing ${query} on ${service}.`,
  music_fail: (query) => `I couldn't play ${query} right now.`,

  search_ok: (query, engine) => `Searching ${engine} for ${query}.`,
  search_fail: (query) => `I couldn't search for ${query}.`,

  timer_ok: (minutes, label) => `Timer set for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  timer_done: (label) => `${label} is done!`,
  timer_cancelled: () => 'Timer cancelled.',

  volume_ok: (level, dir) => `Volume ${dir} to ${level}.`,
  volume_set_ok: (level) => `Volume set to ${level}.`,
  volume_fail: () => "I couldn't change the volume.",

  screenshot_ok: (filename) => `Screenshot saved as ${filename}.`,
  screenshot_fail: () => "I couldn't take a screenshot.",

  time_ok: (time, date) => `It's ${time}, on ${date}.`,
  date_ok: (date) => `Today is ${date}.`,

  ai_ok: (text) => text,
  ai_fail: () => "I couldn't think about that right now.",

  weather_ok: (summary) => summary,
  weather_fail: () => "I couldn't get the weather.",

  stop: () => "Okay, cancelled.",
  unknown: () => "Sorry, I didn't catch a command in that."
}

// --- Specific builders ------------------------------------------------

function openApp(result) {
  if (!result || result.success === false) {
    return build('open_app', result, phrases.open_app_fail(result?.launched || 'that'), 'confused')
  }
  if (result.fallback) {
    return build('open_app', result, phrases.open_app_search(result.launched || 'that'), 'happy')
  }
  return build('open_app', result, phrases.open_app_ok(result.launched), 'happy')
}

function playMusic(result, service, extra = {}) {
  if (!result || result.success === false) {
    return build('play_music', result, phrases.music_fail(result?.query || ''), 'error')
  }
  // Surface the launched URL so the frontend can also open it directly.
  return build('play_music', result, phrases.music_ok(result.query || '', service), 'music', { ...extra, openUrl: result.url || undefined })
}

/**
 * Build a response that opens a URL in a new browser tab (frontend handles it).
 * @param {string} url
 * @param {string} name Friendly name for the spoken reply.
 */
function openUrl(url, name) {
  const speak = url ? `Opening ${name || 'that'} for you.` : `I couldn't open that.`
  return build('open_url', { url }, speak, 'happy', { openUrl: url || undefined })
}

/**
 * Build a response that drives the in-app media player (YouTube IFrame).
 * @param {'play'|'next'|'previous'|'pause'|'resume'} action
 * @param {string} speak
 * @param {object} [media] Optional extra media payload (e.g. { query }).
 */
function mediaControl(action, speak, media = {}) {
  return build('media_control', { action }, speak, 'music', { media: { action, ...media } })
}

function webSearch(result, engine) {
  if (!result || result.success === false) {
    return build('web_search', result, phrases.search_fail(result?.query || ''), 'confused')
  }
  return build('web_search', result, phrases.search_ok(result.query || '', engine), 'happy', {
    openUrl: result.url || undefined,
    results: result.results || []
  })
}

function imageSearch(result) {
  if (!result || result.success === false) {
    return build('image_search', result, phrases.search_fail(result?.query || ''), 'confused')
  }
  return build('image_search', result, phrases.search_ok(result.query || '', 'images'), 'happy', { openUrl: result.url || undefined })
}

function setTimer(result) {
  if (!result) return build('set_timer', null, phrases.timer_set_fail(), 'confused')
  return build('set_timer', result, phrases.timer_ok(Math.round(result.minutes), result.label), 'happy')
}

function volume(result, dir) {
  if (!result) return build('volume', null, phrases.volume_fail(), 'error')
  if (dir === 'set') {
    return build('set_volume', result, phrases.volume_set_ok(result.level), 'happy')
  }
  return build('volume', result, phrases.volume_ok(result.level, dir), 'idle')
}

function screenshot(result) {
  if (!result || !result.path) return build('screenshot', result, phrases.screenshot_fail(), 'error')
  return build('screenshot', result, phrases.screenshot_ok(result.filename || 'screenshot'), 'happy')
}

function getTime(result) {
  if (!result) return build('get_time', null, phrases.unknown(), 'confused')
  return build('get_time', result, phrases.time_ok(result.time, result.date), 'happy')
}

function getDate(result) {
  if (!result) return build('get_date', null, phrases.unknown(), 'confused')
  return build('get_date', result, phrases.date_ok(result.date), 'happy')
}

function AI(result) {
  if (!result || result.error) return build('ai_query', result, phrases.ai_fail(), 'error')
  return build('ai_query', result, phrases.ai_ok(result.text || ''), 'talking')
}

function weather(result) {
  if (!result || result.error) return build('get_weather', result, phrases.weather_fail(), 'confused')
  return build('get_weather', result, phrases.weather_ok(result.summary || ''), 'happy')
}

function stop() {
  return build('stop', { cancelled: true }, phrases.stop(), 'idle')
}

function stateChange(state) {
  return build('state', { state }, '', state)
}

module.exports = {
  build,
  phrases,
  openApp,
  playMusic,
  openUrl,
  mediaControl,
  webSearch,
  setTimer,
  volume,
  screenshot,
  getTime,
  getDate,
  AI,
  weather,
  stop,
  stateChange
}
