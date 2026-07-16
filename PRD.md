# NIMO OS — Project Requirements Document (PRD)

## 1. Project Overview

**NIMO OS** is a desktop voice assistant that combines a stylized, emotionally-expressive robot face UI with a robust Electron + Node.js backend. It interprets voice commands through a local intent parser, falls back to Claude (Anthropic) for open-ended queries, and performs OS-level actions (launch apps, control volume, set timers, take screenshots, play music, web search).

Target users: tech enthusiasts, developers integrating LLMs into a desktop shell, and anyone who wants a visually distinctive, companion-like voice assistant running locally on Windows, macOS, or Linux.

---

## 2. Design Identity

| Attribute | Value |
|---|---|
| Visual Style | Cybernetic, dark-mode, high-contrast |
| Primary Color | Bright Cyan `#00E8D6` |
| Surface Colors | Pure Black `#050507` / Near-Black `#0A0A0D` |
| State Colors | Blue-Cyan (Thinking), Cyan-Green (Happy), Amber (Music), Red (Error) |
| Core Component | 280×280px rounded "robot head" with morphing eye modules |
| State Expressions | Idle, Listening, Thinking, Talking, Happy, Confused, Error, Music |

---

## 3. Target Users

- Tech enthusiasts and desktop-gadget collectors.
- Users wanting a more personal/companion-like AI interaction.
- Developers looking for an OS-level LLM interface shell.

---

## 4. Feature List

### 4.1 Voice Pipeline
- Wake-word detection ("hey nimo") strips the wake phrase before processing.
- Local intent parser (priority-ordered regex) handles: play music, open app, web search, set timer, get time, get date, volume up/down/set, screenshot, get weather, stop.
- Catch-all intent forwards unmatched input to Claude (Anthropic API) for a conversational reply.
- 6-message rolling history window for conversational context.
- All AI responses formatted to 1–2 short sentences for TTS clarity.

### 4.2 System Actions
- **App Launcher**: cross-platform (win/mac/linux), fuzzy-matched against an OS map, Levenshtein distance ≤ 3 fallback.
- **Volume Control**: `loudness` package + nircmd (win) / osascript (mac) / amixer (linux) fallbacks.
- **Screenshot**: Electron `desktopCapturer` → PNG saved to `~/Pictures/nimo-screenshots/`.
- **Timers**: in-memory `Map`, fires OS Notification + IPC `nimo:timer-done` event.
- **Time/Date**: uses `Intl.DateTimeFormat` via Node `Date` object.

### 4.3 Media & Web
- **Spotify**: `spotify:search:` URI scheme (desktop first) → `open.spotify.com/search` fallback.
- **YouTube**: `youtube.com/results?search_query=` URL in default browser.
- **Web Search**: Google or DuckDuckGo, configurable via `DEFAULT_SEARCH_ENGINE`.

### 4.4 Speech (Renderer)
- `recognizer.js`: `window.SpeechRecognition` / `webkitSpeechRecognition`, one-shot, strips wake word.
- `synthesizer.js`: `window.speechSynthesis`, natural voice selection, rate/pitch/lang config.

### 4.5 Security & Config
- API key stored in OS keychain via `keytar`; migrated from `.env` on first launch.
- Renderer sandboxed: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Whitelist-only IPC channels via `contextBridge`.

### 4.6 Window & Tray
- Frameless, transparent, 320×520px, `alwaysOnTop: true` BrowserWindow.
- System tray with context menu (Show, Hide, Quit).
- `requestSingleInstanceLock` — a second launch focuses the existing window.
- Dev: loads `http://localhost:3000`; Production: loads `./ui/index.html`.

---

## 5. Success Metrics

- All 12 intent parser cases pass unit tests (100% priority-order coverage).
- App boots and loads all modules without throwing.
- API key migrates from `.env` to keychain on first launch.
- IPC handlers return `{ ok, data }` / `{ ok: false, error, code, speak, state }` consistently.
- TTS `speak` text arrives at renderer via `nimo:speak` event for every non-idle action.