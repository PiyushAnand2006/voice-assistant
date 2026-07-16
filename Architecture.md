# NIMO OS — Architecture Document

## 1. Architecture Overview

NIMO follows a strict **main/renderer process split**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS (Node.js)                      │
│                                                                 │
│  electron/main.js                                               │
│    ├── BrowserWindow (320×520, frameless, alwaysOnTop)          │
│    ├── Tray (icon + right-click menu)                            │
│    └── lifecycle (app.whenReady, single-instance lock)           │
│                                                                 │
│  electron/ipc/index.js  ─── dispatchIntent()                    │
│    ├── systemHandler.js  ─── volume, app launch, timer, etc.    │
│    ├── searchHandler.js  ─── web search                          │
│    └── mediaHandler.js  ─── Spotify / YouTube                   │
│                                                                 │
│  core/                                                          │
│    ├── commandParser.js   ─── parseCommand() → { intent, params }│
│    ├── intentMap.js      ─── ordered regex patterns              │
│    ├── aiClient.js       ─── askClaude() + rolling history       │
│    └── responseBuilder.js ─── { action, result, speak, state } │
│                                                                 │
│  services/system/       services/media/       services/web/       │
│    appLauncher.js         spotifyHandler.js    searchService.js  │
│    volumeControl.js       youtubeHandler.js                       │
│    screenshotter.js                                             │
│    timerManager.js                                              │
│                                                                 │
│  config/                                                         │
│    constants.js         ─── all tunable values in one place     │
│    keystore.js          ─── keytar + .env → keychain migration  │
│                                                                 │
│  utils/                                                          │
│    logger.js  osDetect.js  errorHandler.js                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                   contextBridge (preload.js)
                            │
┌─────────────────────────────────────────────────────────────────┐
│                   RENDERER PROCESS (Browser)                     │
│                                                                 │
│  ui/index.html  (Stitch export — provided separately)           │
│                                                                 │
│  services/speech/         window.nimo API                        │
│    recognizer.js   ◄───►  invoke(channel, data)                  │
│    synthesizer.js  ◄───►  on(channel, cb)  /  off(channel, cb)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. File & Folder Structure

```
nimo-backend/
├── electron/
│   ├── main.js              # Electron entry, window, tray
│   ├── preload.js           # contextBridge "window.nimo"
│   └── ipc/
│       ├── index.js         # registerAllIpc() + dispatchIntent()
│       ├── systemHandler.js # OS-level actions
│       ├── searchHandler.js # Web search actions
│       └── mediaHandler.js  # Music/media actions
├── core/
│   ├── commandParser.js     # voice transcript → { intent, params }
│   ├── intentMap.js         # ordered regex intent definitions
│   ├── aiClient.js          # Claude API wrapper + history
│   └── responseBuilder.js  # { action, result, speak, state } formatter
├── services/
│   ├── speech/
│   │   ├── recognizer.js    # SpeechRecognition wrapper (renderer)
│   │   └── synthesizer.js   # SpeechSynthesis TTS (renderer)
│   ├── system/
│   │   ├── appLauncher.js   # cross-platform exec + fuzzy match
│   │   ├── volumeControl.js # system volume up/down/set
│   │   ├── screenshotter.js # Electron desktopCapturer
│   │   └── timerManager.js  # timer/alarm Map + Notification
│   ├── media/
│   │   ├── spotifyHandler.js  # Spotify URI launcher
│   │   └── youtubeHandler.js  # YouTube search URL launcher
│   └── web/
│       └── searchService.js   # Google/DuckDuckGo opener
├── config/
│   ├── constants.js         # all config values
│   └── keystore.js          # keytar + .env key migration
├── utils/
│   ├── logger.js            # leveled file logger
│   ├── osDetect.js          # win32 | darwin | linux
│   └── errorHandler.js      # NimoError class + format() + guard()
├── ui/                      # Stitch export (provided separately)
├── assets/                  # icons (ico/icns/png)
├── logs/                    # nimo.log output
├── .env                     # ANTHROPIC_API_KEY (migrated on first launch)
├── .env.example
├── package.json
└── README.md
```

---

## 3. Technology Stack

| Concern | Choice |
|---|---|
| Runtime | Electron 33 (Chromium 130 + Node.js 20) |
| Language | Node.js (CommonJS, no ESM) |
| AI | `@anthropic-ai/sdk` → Claude Sonnet 4 |
| API key store | `keytar` (OS keychain: Win Credential Manager / macOS Keychain / libsecret) |
| Fuzzy match | `fastest-levenshtein` |
| Volume | `loudness` + platform shell fallbacks |
| Logging | `utils/logger.js` — leveled to file + stdout |
| Config | `dotenv` (dev), OS keychain (prod) |
| Bundler | electron-builder |
| Dev orchestration | `concurrently` |

---

## 4. IPC Channel Architecture

All renderer → main communication flows through `window.nimo.invoke(channel, data)`.
The whitelist of allowed channels is enforced in `preload.js` (`INVOKABLE` Set).

**Request/response pattern** (ipcMain.handle):
- `nimo:run-command` → parses transcript + dispatches intent
- `nimo:ai-query` → direct Claude call with optional history
- `nimo:set-volume`, `nimo:open-app`, `nimo:play-music`, `nimo:web-search`
- `nimo:take-screenshot`, `nimo:set-timer`, `nimo:cancel-timer`, `nimo:list-timers`
- `nmo:get-time`, `nimo:get-weather`
- `nimo:save-api-key`, `nimo:has-api-key`

**Push pattern** (ipcMain.on / webContents.send):
- `nimo:timer-done` — timer fired (main → renderer)
- `nimo:state-change` — state machine update (main → renderer)
- `nimo:speak` — TTS text ready (main → renderer)
- `nimo:config` — startup config snapshot (main → renderer)

---

## 5. Intent Dispatch Flow

```
parseCommand(transcript)
  └─ iterates intentMap.intents in order
     └─ FIRST pattern match wins
        └─ extract params (intent.params ? params(m) : {})
           └─ dispatchIntent(intentName, params, mainWindow)
              ├─ play_music     → spotifyHandler / youtubeHandler
              ├─ open_app       → appLauncher.openApp()
              ├─ web_search     → searchService.openSearch()
              ├─ set_timer      → timerManager.setTimer()
              ├─ get_time/date  → new Date() formatting
              ├─ volume_up/down → volumeControl.{volumeUp,volumeDown,setVolume}
              ├─ screenshot     → screenshotter.takeScreenshot()
              ├─ get_weather    → shell.openExternal(wttr.in)
              ├─ ai_query       → aiClient.askClaude() → pushSpeak() + state 'talking'
              └─ stop           → timerManager.cancelAll() → state 'idle'
              └─ responseBuilder.*() → { action, result, speak, state }
```

---

## 6. Security Architecture

```
Renderer sandbox: contextIsolation:true  nodeIntegration:false  sandbox:true
                            │
                   contextBridge (whitelist only)
                            │
         Only these channels: INVOKABLE (invoke) + RENDERABLE (push)
                            │
         API key never sent to renderer — lives only in main process env
         keytar: OS keychain — never written to disk in production
```