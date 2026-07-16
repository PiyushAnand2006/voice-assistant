/**
 * services/speech/synthesizer.js
 * SpeechSynthesis (TTS) wrapper — runs in the RENDERER (browser) process.
 *
 * Exposes: { speak(text), stop(), pause(), resume(), getVoices(), onEnd(cb) }
 *
 * Voice selection heuristic:
 *   1. Prefer an English (TTS_LANG) local/natural voice if available.
 *   2. Otherwise the first matching-language voice.
 *   3. Otherwise the first available voice.
 *
 * Defaults come from window.NIMO_CONFIG (injected by preload / main), falling
 * back to sensible defaults.
 */

(function () {
  'use strict'

  // Defensive: this file is meant for browser only. No-op if loaded in Node.
  const hasWindow = typeof window !== 'undefined'
  if (!hasWindow) return

  const DEFAULTS = Object.assign(
    {
      TTS_RATE: 1.05,
      TTS_PITCH: 1.0,
      TTS_LANG: 'en-US'
    },
    (window.NIMO_CONFIG || {})
  )

  const synth = {
    utterance: null,
    speaking: false,
    _onEnd: null,
    _onStart: null,
    _onError: null,
    _voices: [],

    isSupported() {
      return typeof window !== 'undefined' && 'speechSynthesis' in window
    },

    /**
     * Populate the voices list (async on some browsers).
     * @returns {Promise<SpeechSynthesisVoice[]>}
     */
    loadVoices() {
      return new Promise((resolve) => {
        if (!this.isSupported()) return resolve([])
        const collect = () => {
          const v = window.speechSynthesis.getVoices() || []
          this._voices = v
          resolve(v)
        }
        const v = window.speechSynthesis.getVoices()
        if (v && v.length) {
          this._voices = v
          return resolve(v)
        }
        window.speechSynthesis.onvoiceschanged = collect
        // Safety timeout: some browsers never fire the event.
        setTimeout(collect, 1000)
      })
    },

    getVoices() {
      return this._voices
    },

    /**
     * Pick the best available voice for the configured language.
     */
    pickVoice() {
      const lang = DEFAULTS.TTS_LANG
      const voices = this._voices
      if (!voices.length) return null
      // Prefer a local, natural English voice.
      const natural = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase(0, 2)) && /natural|google|samantha|aria|jenny|guy|davis/i.test(v.name))
      if (natural) return natural
      // Then any voice whose lang starts with the primary subtag.
      const langMatch = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)))
      if (langMatch) return langMatch
      return voices[0]
    },

    /**
     * Speak the given text. Cancels any in-flight utterance first.
     * @param {string} text
     * @param {{rate?:number, pitch?:number, lang?:string}} [opts]
     */
    speak(text, opts) {
      if (!this.isSupported()) {
        if (this._onEnd) this._onEnd()
        return
      }
      const t = String(text || '').trim()
      if (!t) {
        if (this._onEnd) this._onEnd()
        return
      }

      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(t)
      u.rate = (opts && typeof opts.rate === 'number') ? opts.rate : DEFAULTS.TTS_RATE
      u.pitch = (opts && typeof opts.pitch === 'number') ? opts.pitch : DEFAULTS.TTS_PITCH
      u.lang = (opts && opts.lang) || DEFAULTS.TTS_LANG
      const voice = this.pickVoice()
      if (voice) u.voice = voice

      u.onstart = () => {
        this.speaking = true
        if (window.nimo && window.nimo.invoke) {
          window.nimo.invoke('nimo:state-event', { state: 'talking' })
        }
        if (this._onStart) this._onStart()
      }
      u.onend = () => {
        this.speaking = false
        if (window.nimo && window.nimo.invoke) {
          window.nimo.invoke('nimo:state-event', { state: 'idle' })
        }
        if (this._onEnd) this._onEnd()
      }
      u.onerror = (e) => {
        this.speaking = false
        if (this._onError) this._onError(e)
        if (this._onEnd) this._onEnd()
      }

      this.utterance = u
      window.speechSynthesis.speak(u)
    },

    stop() {
      if (!this.isSupported()) return
      try { window.speechSynthesis.cancel() } catch (_) { /* noop */ }
      this.speaking = false
    },

    pause() {
      if (this.isSupported() && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
      }
    },

    resume() {
      if (this.isSupported() && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
    },

    onEnd(cb) { this._onEnd = cb; return this },
    onStart(cb) { this._onStart = cb; return this },
    onError(cb) { this._onError = cb; return this }
  }

  if (typeof window !== 'undefined') {
    window.NimoSynthesizer = synth
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = synth
  }
})()
