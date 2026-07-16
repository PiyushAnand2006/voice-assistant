module.exports = {
  // AI / Gemini
  AI_MODEL: 'gemini-3.1-flash-lite',
  AI_MAX_TOKENS: 1000,
  AI_HISTORY_LENGTH: 6,
  AI_SYSTEM_PROMPT: `You are NIMO, a friendly and witty desktop voice assistant.
Rules:
- Always respond in 1-2 short sentences max (for TTS clarity)
- Be warm, helpful, slightly playful
- Never say "As an AI..." or "I cannot..."
- If you don't know something current, say so briefly and suggest a search`,

  // Media / Search defaults
  DEFAULT_MUSIC_SERVICE: 'spotify',
  DEFAULT_SEARCH_ENGINE: 'google',

  // Volume
  VOLUME_STEP: 10,
  VOLUME_MIN: 0,
  VOLUME_MAX: 100,

  // Wake word & speech
  WAKE_WORD: 'hey nimo',

  // TTS
  TTS_RATE: 1.05,
  TTS_PITCH: 1.0,
  TTS_LANG: 'en-US',

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_NAME: process.env.ELEVENLABS_VOICE_NAME || 'Eva - Futuristic Robot Helper',
  ELEVENLABS_FALLBACK_VOICE_ID: process.env.ELEVENLABS_FALLBACK_VOICE_ID || '',
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',

  // Screenshot
  SCREENSHOT_DIR: 'nimo-screenshots',

  // Window
  WINDOW_WIDTH: 320,
  WINDOW_HEIGHT: 520,

  // Logging
  LOG_LEVEL: 'info',
  LOG_DIR: 'logs',

  // Keystore
  KEYTAR_SERVICE: 'NIMO',
  KEYTAR_ACCOUNT: 'gemini',

  // UI source (nimo-os Stitch export — sibling folder to nimo-backend)
  UI_BUILD_PATH: '../nimo-os/dist',
  DEV_SERVER_URL: 'http://localhost:3000',

  // NIMO backend HTTP server (nimo-os proxies here)
  HTTP_SERVER_PORT: 3001,

  // NIMO backend root URL (used by nimo-os proxy)
  NIMO_BACKEND_URL: 'http://localhost:3001'
}