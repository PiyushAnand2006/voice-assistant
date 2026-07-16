/**
 * core/commandParser.js
 * Entry point for the voice → action pipeline.
 *
 *   parseCommand(transcript) → { intent, params } | null
 *
 * Local intents are checked FIRST (in priority order). If none match (which is
 * rare because the return-all `ai_query` intent is the fallback), we return null
 * so the caller can decide what to do. Because intentMap always has an ai_query
 * catch-all anchored by `/.+/`, matcher() will never actually return null.
 */

const { intents, stripWake } = require('./intentMap')
const logger = require('../utils/logger')

/**
 * Parse a raw transcript into { intent, params }.
 * @param {string} transcript Raw recognized speech text.
 * @param {{intent?: string}} [opts]
 * @returns {{ intent: string, params: object, raw: string } | null}
 */
function parseCommand(transcript, opts = {}) {
  if (!transcript || typeof transcript !== 'string') return null

  // Strip a leading wake word ("hey nimo, ...") if present.
  const text = stripWake(transcript)
  if (!text) return null

  for (const intent of intents) {
    if (intent.exclude && intent.exclude(text)) {
      continue
    }
    if (!intent.patterns || intent.patterns.length === 0) {
      continue
    }

    // Test each pattern for this intent; first matching pattern wins.
    for (const p of intent.patterns) {
      const m = p.exec(text)
      if (m) {
        let params = {}
        if (typeof intent.params === 'function') {
          params = intent.params(m) || {}
        }
        const result = { intent: intent.name, params, raw: transcript }
        logger.debug(`parseCommand: "${text}" -> ${intent.name} ${JSON.stringify(params)}`)
        return result
      }
    }
  }

  // Fallback: if we somehow fall off the list, treat as AI query with the full text.
  logger.warn(`parseCommand: no pattern matched "${text}" (should not happen; ai_query is catch-all).`)
  return { intent: 'ai_query', params: { text }, raw: transcript }
}

/**
 * Extract params for a given intent name from a transcript.
 * Useful when a command name is known but params must be parsed retroactively.
 * @param {string} transcript Raw recognized speech text.
 * @param {string} intentName Target intent name.
 * @returns {object | null}
 */
function extractParams(transcript, intentName) {
  if (!transcript) return null
  const text = stripWake(transcript)
  const intent = intents.find((i) => i.name === intentName)
  if (!intent || !intent.patterns) return null
  for (const p of intent.patterns) {
    const m = p.exec(text)
    if (m) {
      return typeof intent.params === 'function' ? intent.params(m) : {}
    }
  }
  return null
}

module.exports = { parseCommand, extractParams }
