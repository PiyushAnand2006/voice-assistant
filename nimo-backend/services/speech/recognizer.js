/**
 * services/speech/recognizer.js
 * SpeechRecognition wrapper — runs in the RENDERER (browser) process.
 *
 * This file is intentionally framework-agnostic and relies only on the
 * `window.nimo` preload bridge to forward transcripts to the main process.
 * It does NOT require Node; it must be importable from a <script> tag or ESM.
 *
 * Wake-word handling: if the transcript starts with the configured WAKE_WORD,
 * it is stripped and only the remainder is surfaced via onResult.
 *
 * Exposes: { start(), stop(), onResult(cb), onError(cb), onEnd(cb), isListening }
 */

(function () {
  'use strict'

  // Defensive: this file is meant for browser only. No-op if loaded in Node.
  const hasWindow = typeof window !== 'undefined'
  if (!hasWindow) return

  const WAKE_WORD = (window.NIMO_CONFIG && window.NIMO_CONFIG.WAKE_WORD) || 'hey nimo'
  const RECOG = window.SpeechRecognition || window.webkitSpeechRecognition

  const recognizer = {
    recognition: null,
    listening: false,

    _onResult: null,
    _onError: null,
    _onEnd: null,
    _onStart: null,

    isSupported() {
      return Boolean(RECOG)
    },

    /**
     * Start a one-shot recognition session.
     */
    start() {
      if (!this.isSupported()) {
        const err = new Error('SpeechRecognition is not supported in this browser.')
        if (this._onError) this._onError(err)
        return false
      }
      this.recognition = new RECOG()
      this.recognition.lang = (window.NIMO_CONFIG && window.NIMO_CONFIG.TTS_LANG) || 'en-US'
      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.maxAlternatives = 1

      this.recognition.onstart = () => {
        this.listening = true
        if (window.nimo && window.nimo.invoke) {
          window.nimo.invoke('nimo:state-event', { state: 'listening' })
        }
        if (this._onStart) this._onStart()
      }

      this.recognition.onresult = (event) => {
        const transcript = event.results && event.results[0] && event.results[0][0]
          ? event.results[0][0].transcript
          : ''
        const confidence = event.results && event.results[0] && event.results[0][0]
          ? event.results[0][0].confidence
          : 0
        const cleaned = stripWake(transcript)
        if (this._onResult) this._onResult(cleaned, confidence)
      }

      this.recognition.onerror = (event) => {
        const err = new Error(event.error || 'SpeechRecognition error')
        err.code = event.error
        if (this._onError) this._onError(err)
      }

      this.recognition.onend = () => {
        this.listening = false
        if (this._onEnd) this._onEnd()
      }

      try {
        this.recognition.start()
        return true
      } catch (err) {
        // start() throws if called again too quickly; surface as error.
        if (this._onError) this._onError(err)
        return false
      }
    },

    stop() {
      if (this.recognition && this.listening) {
        try { this.recognition.stop() } catch (_) { /* noop */ }
      }
      this.listening = false
    },

    onResult(cb) { this._onResult = cb; return this },
    onError(cb) { this._onError = cb; return this },
    onEnd(cb) { this._onEnd = cb; return this },
    onStart(cb) { this._onStart = cb; return this }
  }

  function stripWake(text) {
    if (!text) return ''
    const lower = String(text).toLowerCase().trim()
    const ww = WAKE_WORD.toLowerCase()
    if (lower.startsWith(ww)) {
      return text.trim().slice(ww.length).replace(/^[,\s]+/, '').trim()
    }
    return text.trim()
  }

  // Expose globally for the UI to consume.
  if (typeof window !== 'undefined') {
    window.NimoRecognizer = recognizer
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recognizer, stripWake }
  }
})()
