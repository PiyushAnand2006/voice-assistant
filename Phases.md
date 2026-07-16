# NIMO OS — Project Phases

## Phase 1 — Backend Shell (COMPLETED)
**Goal**: Full Node.js/Electron backend with zero UI components.

- [x] `package.json` with all dependencies + electron-builder config
- [x] `config/constants.js` + `config/keystore.js`
- [x] `utils/` — logger, osDetect, errorHandler
- [x] `core/` — commandParser, intentMap, aiClient, responseBuilder
- [x] `services/system/` — appLauncher, volumeControl, screenshotter, timerManager
- [x] `services/media/` — spotifyHandler, youtubeHandler
- [x] `services/web/` — searchService
- [x] `services/speech/` — recognizer.js, synthesizer.js (renderer-only, browser-safe)
- [x] `electron/main.js` — BrowserWindow, tray, single-instance, lifecycle
- [x] `electron/preload.js` — whitelisted contextBridge API
- [x] `electron/ipc/` — index (dispatchIntent), systemHandler, searchHandler, mediaHandler
- [x] Syntax validation across all 24 JS files (100% pass)
- [x] Functional smoke test: 20/20 intent parser cases pass
- [x] Timer manager fires Notification + IPC event correctly
- [x] All native modules load (electron, keytar, loudness, fastest-levenshtein)
- [x] Speech modules safely guard against Node.js require
- [x] README.md + assets/README.md

---

## Phase 2 — Stitch UI Integration
**Goal**: Wire the pre-built Stitch UI into Electron and connect window controls.

- [ ] Place Stitch export at `nimo-backend/ui/index.html`
- [ ] Configure `config/constants.js > UI_BUILD_PATH` for production path
- [ ] Configure `config/constants.js > DEV_SERVER_URL` for dev server URL
- [ ] Test that `npm start` in production loads `./ui/index.html`
- [ ] Test that `npm run dev` loads `http://localhost:3000`
- [ ] Hook `nimo:window-control` (hide/show/quit) to a title-bar-less drag region or tray
- [ ] Verify all 3 push events reach the renderer: `nimo:state-change`, `nimo:speak`, `nimo:timer-done`
- [ ] Inject `nimo:config` startup payload into renderer (WAKE_WORD, TTS_*, AI_MODEL)

---

## Phase 3 — Voice Pipeline Integration
**Goal**: End-to-end voice: mic → parse → dispatch → TTS → face animation.

- [ ] Load `services/speech/recognizer.js` in `<script>` tag in `ui/index.html`
- [ ] Load `services/speech/synthesizer.js` in `<script>` tag in `ui/index.html`
- [ ] On renderer `DOMContentLoaded`: call `NimoSynthesizer.loadVoices()`
- [ ] Wire a "push to talk" or always-listening button to `NimoRecognizer.start()`
- [ ] `recognizer.onResult(text, confidence)` → `window.nimo.invoke('nimo:run-command', { transcript: text })`
- [ ] `nimo:state-change` event handler → update UI face expression state
- [ ] `nimo:speak` event handler → `NimoSynthesizer.speak(text)` (fires TTS)
- [ ] Wake-word "hey nimo" is stripped by `recognizer.js` before sending to main
- [ ] Add a visual "listening" indicator triggered by `nimo:state-change` with `listening` state

---

## Phase 4 — API Key Onboarding
**Goal**: First-launch key setup flow via the Stitch UI.

- [ ] On boot, UI calls `window.nimo.invoke('nimo:has-api-key', {})`
- [ ] If `hasKey: false`, UI shows a simple modal with an API key input field
- [ ] On submit, UI calls `window.nimo.invoke('nimo:save-api-key', { key })`
- [ ] `keystore.js` saves to OS keychain and sets `process.env.ANTHROPIC_API_KEY`
- [ ] After save, UI dismisses modal and shows the normal idle face
- [ ] `.env` key is cleared after successful migration (verified by checking `.env` is empty)

---

## Phase 5 — Packaging & Distribution
**Goal**: Produce distributable `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux).

- [ ] Create `assets/icon.png` (256×256), convert to `icon.ico` and `icon.icns`
- [ ] Place icons in `nimo-backend/assets/`
- [ ] Update `package.json > build > win/mac/linux > icon` paths if needed
- [ ] Run `npm run build` — verify NSIS `.exe` produced for Windows
- [ ] Test the packaged `.exe` launches without dev dependencies installed
- [ ] Test that the packaged app can: launch, show tray, respond to IPC
- [ ] Verify keytar works in the packaged ASAR (may need `asar: false` or extra unpack for native modules)

---

## Phase 6 — Polish & Edge Cases
**Goal**: Robustness, observability, and user experience refinements.

- [ ] Add a startup splash or logging output showing which UI source is loaded
- [ ] Handle `nimo:set-volume` when no audio device is available (graceful degradation)
- [ ] Handle microphone permission denied (show error state in UI, log warning)
- [ ] Handle `nimo:take-screenshot` when pictures directory is not writable
- [ ] Add `nimo:list-timers` UI element (optional: a sidebar timer list)
- [ ] Verify that `aiClient.clearHistory()` is callable (e.g., from a "reset" UI action)
- [ ] Add an explicit "error" state face expression in the Stitch UI, mapped from IPC `state: 'error'`
- [ ] Test that the app survives a Claude API timeout (should return friendly error + TTS)