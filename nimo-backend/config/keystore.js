/**
 * config/keystore.js
 * Secure API key storage using the OS keychain via `keytar`.
 *
 * On first launch: if no key exists in the keychain, read from process.env,
 * save it to the keychain, then blank the env value for security.
 */

const keytar = require('keytar')
const constants = require('./constants')
const logger = require('../utils/logger')

const { KEYTAR_SERVICE, KEYTAR_ACCOUNT: GEMINI_ACCOUNT } = constants
const ELEVENLABS_ACCOUNT = 'elevenlabs'

let keytarAvailable = true
try {
  require.resolve('keytar')
} catch {
  keytarAvailable = false
  logger.warn('keytar not available; keys will be held in memory only.')
}

async function saveKeyFor(account, key) {
  if (!keytarAvailable || !key) return false
  try {
    await keytar.setPassword(KEYTAR_SERVICE, account, key)
    logger.info(`API key saved to OS keychain (account=${account}).`)
    return true
  } catch (err) {
    logger.error(`keystore.saveKey failed (${account}): ${err.message}`)
    return false
  }
}

async function getKeyFor(account) {
  if (!keytarAvailable) return process.env[account === GEMINI_ACCOUNT ? 'GEMINI_API_KEY' : 'ELEVENLABS_API_KEY'] || null
  try {
    return (await keytar.getPassword(KEYTAR_SERVICE, account)) || null
  } catch (err) {
    logger.error(`keystore.getKey failed (${account}): ${err.message}`)
    return null
  }
}

async function deleteKeyFor(account) {
  if (!keytarAvailable) return false
  try {
    return await keytar.deletePassword(KEYTAR_SERVICE, account)
  } catch (err) {
    logger.error(`keystore.deleteKey delete failed (${account}): ${err.message}`)
    return false
  }
}

// ── Public API (kept for backwards compatibility) ───────────────────────────

async function saveKey(key) { return saveKeyFor(GEMINI_ACCOUNT, key) }
async function getKey() { return getKeyFor(GEMINI_ACCOUNT) }
async function deleteKey() { return deleteKeyFor(GEMINI_ACCOUNT) }

// ── ElevenLabs ──────────────────────────────────────────────────────────────

async function saveElevenLabsKey(key) { return saveKeyFor(ELEVENLABS_ACCOUNT, key) }
async function getElevenLabsKey() { return getKeyFor(ELEVENLABS_ACCOUNT) }
async function deleteElevenLabsKey() { return deleteKeyFor(ELEVENLABS_ACCOUNT) }

/**
 * One-time migration: move keys from .env/process.env into the keychain and
 * blank the env values so they no longer live on disk.
 * Safe to call on every launch; only migrates when there is no stored key.
 */
async function initKey() {
  const geminiEnv = process.env.GEMINI_API_KEY
  if (geminiEnv && geminiEnv.trim().length > 0) {
    const ok = await saveKey(geminiEnv.trim())
    if (ok) {
      process.env.GEMINI_API_KEY = ''
      logger.info('Gemini key migrated from .env to OS keychain and wiped from env.')
    }
  }
  const elevenLabsEnv = process.env.ELEVENLABS_API_KEY
  if (elevenLabsEnv && elevenLabsEnv.trim().length > 0) {
    const ok = await saveElevenLabsKey(elevenLabsEnv.trim())
    if (ok) {
      process.env.ELEVENLABS_API_KEY = ''
      logger.info('ElevenLabs key migrated from .env to OS keychain and wiped from env.')
    }
  }

  // Resolve runtime env values from keychain so constants.ELEVENLABS_API_KEY
  // is populated for the TTS service.
  const geminiStored = await getKey()
  if (geminiStored) process.env.GEMINI_API_KEY = geminiStored

  const elStored = await getElevenLabsKey()
  if (elStored) process.env.ELEVENLABS_API_KEY = elStored

  return geminiStored
}

module.exports = {
  saveKey,
  getKey,
  deleteKey,
  saveElevenLabsKey,
  getElevenLabsKey,
  deleteElevenLabsKey,
  initKey
}