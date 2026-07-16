/**
 * services/tts/elevenLabsTts.js
 * ElevenLabs Text-to-Speech wrapper.
 *
 *   synthesize(text) → { audio: <base64 string>, mimeType: 'audio/mpeg', voice: { id, name } }
 *
 * - Uses native fetch (Node 18+ / 22+).
 * - Voice name is resolved to a voice_id lazily on first call (one fetch to
 *   /v1/voices) and cached. If the voice is not found in the user's library,
 *   we fall back to the environment `ELEVENLABS_FALLBACK_VOICE_ID` or throw
 *   a friendly error.
 * - Returns base64-encoded MP3 audio so it can travel over our HTTP JSON API
 *   cleanly. (Streaming via SSE is possible but adds complexity.)
 */

const constants = require('../../config/constants')
const logger = require('../../utils/logger')

// We read the API key from process.env at runtime (not at module load),
// so that keystore.initKey() can populate process.env.ELEVENLABS_API_KEY
// from the OS keychain after constants.js has already been evaluated.
const ELEVENLABS_VOICE_NAME = constants.ELEVENLABS_VOICE_NAME
const ELEVENLABS_FALLBACK_VOICE_ID = constants.ELEVENLABS_FALLBACK_VOICE_ID

const BASE = 'https://api.elevenlabs.io/v1'

let resolvedVoiceId = null
let resolutionPromise = null

/**
 * Resolve the user-specified voice name to its voice_id by listing voices.
 * Returns the FIRST match for the given name (case-insensitive substring).
 */
async function resolveVoiceId() {
  if (resolvedVoiceId) return resolvedVoiceId
  if (resolutionPromise) return resolutionPromise

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set.')
  }

  if (ELEVENLABS_FALLBACK_VOICE_ID) {
    resolvedVoiceId = ELEVENLABS_FALLBACK_VOICE_ID
    return resolvedVoiceId
  }

    resolutionPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/voices`, {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
      })
      if (!res.ok) {
        throw new Error(`ElevenLabs /voices ${res.status}: ${await res.text()}`)
      }
      const data = await res.json()
      const wanted = (ELEVENLABS_VOICE_NAME || '').toLowerCase().trim()
      const match = (data.voices || []).find((v) => {
        const n = (v.name || '').toLowerCase().trim()
        return n === wanted || n.includes(wanted) || wanted.includes(n)
      })
      if (!match) {
        throw new Error(`Voice "${ELEVENLABS_VOICE_NAME}" not found in ElevenLabs library.`)
      }
      resolvedVoiceId = match.voice_id
      logger.info(`ElevenLabs voice resolved: "${match.name}" → ${resolvedVoiceId}`)
      return resolvedVoiceId
    } finally {
      resolutionPromise = null
    }
  })()

  return resolutionPromise
}

/**
 * Convert text → MP3 audio bytes via ElevenLabs.
 * Returns an object suitable for JSON transport.
 *
 * @param {string} text
 * @param {{ voiceId?: string, modelId?: string, stability?: number, similarity?: number }} [opts]
 */
async function synthesize(text, opts) {
  if (!text || !text.trim()) {
    return { audio: '', mimeType: 'audio/mpeg', silent: true }
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set in env or keystore.')
  }

  const voiceId = opts?.voiceId || (await resolveVoiceId())
  const modelId = opts?.modelId || constants.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const url = `${BASE}/text-to-speech/${voiceId}`

  const body = {
    text: String(text).slice(0, 4500),
    model_id: modelId,
    voice_settings: {
      stability: typeof opts?.stability === 'number' ? opts.stability : 0.5,
      similarity_boost: typeof opts?.similarity === 'number' ? opts.similarity : 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`ElevenLabs ${res.status}: ${errText || res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const audio = Buffer.from(arrayBuffer).toString('base64')

  logger.info(`ElevenLabs synthesized ${audio.length} bytes (base64) for " ${text.slice(0, 40)}…`)
  return {
    audio,
    mimeType: 'audio/mpeg',
    voice: { id: voiceId, name: ELEVENLABS_VOICE_NAME || null }
  }
}

function validateConfig() {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

module.exports = { synthesize, resolveVoiceId, validateConfig, BASE }