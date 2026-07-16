/**
 * core/aiClient.js
 * Thin wrapper around the Google Gemini SDK.
 *
 *   askClaude(userText, conversationHistory) → string  (name kept for compat)
 *
 * Keeps the last N messages (AI_HISTORY_LENGTH) in memory for context
 * continuity across turns. The conversation window is managed in-process.
 */

const { GoogleGenAI } = require('@google/genai')
const constants = require('../config/constants')
const logger = require('../utils/logger')
const { NimoError } = require('../utils/errorHandler')

const { AI_MODEL, AI_MAX_TOKENS, AI_SYSTEM_PROMPT, AI_HISTORY_LENGTH } = constants

let client = null
/** In-memory conversation window: [{ role, content }, ...] */
let history = []

/**
 * Lazy-initialize the Gemini client. The API key is read from the OS
 * keychain (via keystore) by the main process during startup and placed in
 * process.env.GEMINI_API_KEY.
 * @returns {GoogleGenAI}
 */
function getClient() {
  if (client) return client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new NimoError(
      'NO_API_KEY',
      'Gemini API key not configured.',
      'I do not have an API key set. Please add one in your settings.',
      'error'
    )
  }
  client = new GoogleGenAI({ apiKey })
  logger.info(`aiClient initialized with model=${AI_MODEL}.`)
  return client
}

/**
 * Send userText to Gemini, using the rolling history window.
 * @param {string} userText
 * @param {Array<{role:string, content:string}>} [conversationHistory] Optional override history.
 * @returns {Promise<string>} the assistant reply text.
 */
async function askClaude(userText, conversationHistory) {
  if (!userText || !userText.trim()) return ''

  const ai = getClient()

  let prior = Array.isArray(conversationHistory) && conversationHistory.length
    ? conversationHistory.slice(-AI_HISTORY_LENGTH)
    : history.slice(-AI_HISTORY_LENGTH)

  const messages = [...prior, { role: 'user', parts: [{ text: userText }] }]

  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: messages,
      config: {
        systemInstruction: AI_SYSTEM_PROMPT,
        maxOutputTokens: AI_MAX_TOKENS,
        temperature: 0.7
      }
    })

    const reply = response.text?.trim() || ''

    if (!Array.isArray(conversationHistory)) {
      history.push({ role: 'user', parts: [{ text: userText }] })
      history.push({ role: 'model', parts: [{ text: reply }] })
      const maxEntries = AI_HISTORY_LENGTH * 2
      if (history.length > maxEntries) {
        history = history.slice(-maxEntries)
      }
    }

    logger.debug(`askClaude reply: "${reply}"`)
    return reply
  } catch (err) {
    if (err instanceof NimoError) throw err
    const code = err.status ? `AI_${err.status}` : 'AI_ERROR'
    throw new NimoError(
      code,
      err.message || 'Unknown Gemini API error.',
      'I had trouble thinking about that. Maybe try again?',
      'error'
    )
  }
}

function clearHistory() {
  history = []
  logger.info('AI conversation history cleared.')
}

function getHistory() {
  return [...history]
}

module.exports = { askClaude, clearHistory, getHistory }