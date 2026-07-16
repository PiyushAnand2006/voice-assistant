# NIMO OS — Memory (Running Notes)

> This file is created during development, not at project start.
> It is updated as features are built, bugs are found, and decisions are made.
> Purpose: keep future chat sessions or new AI tools up to speed instantly.

---

## Current Status — Backend COMPLETE ✅

**All 24 JavaScript files built and verified. npm dependencies installed. Phase 1 DONE.**

---

## What Was Built

### Backend Structure (nimo-backend/)
```
24 JS files across:
  electron/       (4 files: main, preload, 3 IPC handlers)
  core/            (4 files: commandParser, intentMap, aiClient, responseBuilder)
  services/system/ (4 files: appLauncher, volumeControl, screenshotter, timerManager)
  services/media/  (2 files: spotifyHandler, youtubeHandler)
  services/web/    (1 file: searchService)
  services/speech/ (2 files: recognizer, synthesizer — browser-safe)
  config/          (2 files: constants, keystore)
  utils/           (3 files: logger, osDetect, errorHandler)
```

### Verified Working
- All 24 JS files: zero syntax errors (`new Function()` check)
- Intent parser: 20/20 test cases pass (including "start a timer for 3 minutes and 30 seconds")
- Timer manager fires correctly (Notification error is expected outside Electron, caught + logged)
- `npm install` completes (electron 33.4.11, keytar 7.9.0, loudness 0.4.1, all loaded)
- `OS=win32` correctly detected on this Windows machine

### Key Design Decisions Made

1. **Intent ordering**: `get_time`, `get_date`, `set_timer`, `set_volume`, `volume_up/down` all appear BEFORE `web_search` to prevent greedy `what(?:'s| is) (.+)` from matching time queries. This fixed the `what's the time` → web_search bug.

2. **Timer regex**: Split into 3 ordered patterns:
   - Pattern 1: `"X minutes and a half"` → `mins + 0.5`
   - Pattern 2: `"X minutes and Y seconds"` → `mins + secs/60`
   - Pattern 3: `"X minutes"` → `mins`
   This avoids a single regex where the optional seconds clause would swallow the "and a half" variant.

3. **Speech modules browser-safe**: `recognizer.js` and `synthesizer.js` now have `if (!hasWindow) return` guard at the top of their IIFE. They are still valid browser scripts but won't crash `require()` in Node during development.

4. **API key migration**: `keystore.initKey()` is called in `main.js bootstrap()`. It checks keychain first → if empty, reads from `process.env.ANTHROPIC_API_KEY` (set by `dotenv` from `.env`) → saves to keychain → blanks the env variable. On subsequent launches the keychain is found and used.

5. **IPC return shape**: All handlers return `{ ok: true, data }` or `{ ok: false, error, code, speak, state }`. The `speak` field is TTS-ready text surfaced to the renderer via `nimo:speak` push event.

6. **State push**: `dispatchIntent` calls `pushStateChange(mainWindow, envelope.state)` after each intent, except for `ai_query` which pre-pushes `thinking` before the API call and `talking` via `pushSpeak`.

---

## Known Limitations (Non-Blocking)

1. **Weather**: `get_weather` opens `wttr.in` in browser — no actual weather data is parsed. Replace with a real API (OpenWeatherMap, etc.) in Phase 6.

2. **Volume get**: `getVolume()` returns a fallback of `50` when `loudness` fails and the shell fallback (nircmd/osascript) also can't read the current level. This is acceptable; the real volume is set correctly but the read-back may be stale.

3. **Screenshot**: `desktopCapturer.getSources()` requires `getUserMedia` permission on some platforms. The fallback is `source[0]` (primary display). Full multi-monitor support is deferred.

4. **Tray icon**: If no `assets/icon.*` files exist, a 16×16 cyan PNG buffer is generated in-memory. The tray still works but has no custom icon.

5. **UI not yet integrated**: `ui/index.html` does not exist yet. In production (`NODE_ENV=production`), `main.js` loads a placeholder `data:` URL. In dev (`NODE_ENV=development`), it tries `http://localhost:3000`. The Stitch UI must be provided and placed at `./ui/index.html`.

---

## Pending Work

- **Phase 2**: Integrate Stitch UI at `ui/index.html`
- **Phase 3**: Wire voice pipeline (mic → IPC → TTS → face state)
- **Phase 4**: API key onboarding modal
- **Phase 5**: Create `assets/icon.*`, run `npm run build` → NSIS `.exe`
- **Phase 6**: Polish, edge cases, multi-platform testing

---

## To Start the Dev Server

```bash
# Terminal 1: UI dev server (Stitch)
npm run ui:dev   # echo command — replace with actual Stitch dev command

# Terminal 2: Electron
npm start         # or: node_modules/.bin/electron .
```

## To Run the Backend Without UI

```bash
cd nimo-backend
node -e "
require('dotenv').config();
const cp=require('./core/commandParser');
const tm=require('./services/system/timerManager');
const vc=require('./services/system/volumeControl');
console.log('try:', JSON.stringify(cp.parseCommand('play songs')));
"
```

---

## Config Values Summary (constants.js)

| Key | Default |
|---|---|
| `AI_MODEL` | `claude-sonnet-4-6` |
| `AI_MAX_TOKENS` | `300` |
| `AI_HISTORY_LENGTH` | `6` |
| `DEFAULT_MUSIC_SERVICE` | `spotify` |
| `DEFAULT_SEARCH_ENGINE` | `google` |
| `VOLUME_STEP` | `10` |
| `WAKE_WORD` | `hey nimo` |
| `TTS_RATE` | `1.05` |
| `TTS_PITCH` | `1.0` |
| `TTS_LANG` | `en-US` |
| `LOG_LEVEL` | `info` |
| `WINDOW_WIDTH` / `HEIGHT` | `320` / `520` |