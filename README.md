# NIMO — Desktop Voice Assistant (Basic API-based Search Assistant)

NIMO is a cross-platform **desktop voice assistant** with a minimalist "robot face" UI. Speak (or type) a command and NIMO parses the intent, executes it locally — opening apps, playing music, setting timers, adjusting volume, taking screenshots — or falls back to a **Gemini-powered conversational AI** for everything else, then speaks the response back to you.

The repository is a monorepo with two packages:

| Package        | Role                                                                 |
|----------------|----------------------------------------------------------------------|
| `nimo-backend` | Electron main process, intent parser, system/media/search services, AI client, HTTP API server |
| `nimo-os`      | React + Vite UI ("NIMO OS") with an Express server that proxies commands to the backend |

---

## ✨ Features

### Voice & Conversation
- 🎤 **Voice input** via the Web Speech API, with an optional **"hey nimo" wake word**
- 💬 **AI chat fallback** — anything that isn't a recognized command goes to Google Gemini with a rolling 6-message conversation window for context
- 🔊 **Speech output** — browser SpeechSynthesis by default, with optional **ElevenLabs** TTS for a futuristic robot voice
- 🎭 **Personality modes** (e.g. `friendly`) and animated robot-face states: `idle`, `listening`, `thinking`, `talking`, `happy`, `confused`, `error`, `music`

### System Control
- 🚀 **App launcher** with cross-platform exec + fuzzy matching (Levenshtein distance)
- 🔉 **Volume control** — up / down / set exact level (`loudness` with OS-level fallbacks)
- 📸 **Screenshots** via Electron `desktopCapturer`, saved to `nimo-screenshots/`
- ⏱️ **Timers** — set / cancel / list ("set a timer for 5 minutes"), with a `timer-done` event
- 🕒 **Time & date** queries, 🌦️ **weather** lookups
- 🪟 **Close browser tabs/windows** and a `stop` command to interrupt playback

### Media & Web
- 🎵 **Music playback** — Spotify (default) and YouTube
- ⏭️ Playback control — next / previous / pause / resume
- 🔎 **Web search** — Google, DuckDuckGo, or Bing, with **inline result snippets** (parsed live from DuckDuckGo) shown in the UI
- 🖼️ **Image search** — opens Google Images

### UI / UX
- 🖥️ Frameless, transparent, always-on-top desktop window + **system tray** icon
- 📊 **Event log panel** — voice transcripts, detected intents, AI replies, errors
- ⌨️ **Manual text input** as an alternative to voice
- ⏸️ Auto-deactivation of voice after 15 s of inactivity

---

## 🛠️ Tech Stack

### Backend (`nimo-backend`)
| Technology | Purpose |
|---|---|
| **Node.js** (18+, Node 20+ recommended) | Runtime |
| **Electron 33** | Desktop shell — frameless window, tray, IPC |
| **@google/genai** | Google Gemini AI client (`gemini-3.1-flash-lite`) for conversational responses |
| **@anthropic-ai/sdk** | Anthropic SDK (available as an alternative AI provider) |
| **keytar** | OS keychain storage for API keys |
| **loudness** | System volume control |
| **fastest-levenshtein** | Fuzzy app-name matching |
| **dotenv** | Environment configuration |
| **electron-builder** | Packaging (NSIS `.exe` / `.dmg` / `.AppImage`) |
| **concurrently** | Runs UI dev server + Electron together in dev |
| **node:test** | Built-in test runner (`npm test`) |

### Frontend (`nimo-os`)
| Technology | Purpose |
|---|---|
| **React 19** + **TypeScript** | UI framework |
| **Vite 6** | Dev server & bundler |
| **Tailwind CSS 4** | Styling |
| **motion (Framer Motion)** | Animations & transitions |
| **lucide-react** | Icons |
| **Express 4** | API server that proxies `/api/run-command` and `/api/tts` to the backend |
| **tsx / esbuild** | TypeScript server execution & production bundling |

### External APIs
- **Google Gemini** — conversational AI (requires `GEMINI_API_KEY`)
- **ElevenLabs** (optional) — high-quality TTS (`ELEVENLABS_API_KEY`)
- **DuckDuckGo / Google / Bing** — web & image search

---

## ⚙️ How It Works

```text
┌─────────────────────────── nimo-os (port 3000) ───────────────────────────┐
│  React UI (robot face, logs, settings, personality)                        │
│  [mic] → Web Speech API recognizer ── strips "hey nimo" wake word          │
│  SpeechSynthesis / ElevenLabs TTS ← response                               │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │ POST /api/run-command { transcript }
                               ▼
┌──────────────────────── nimo-backend (port 3001) ─────────────────────────┐
│  commandParser.parseCommand → intentMap (ordered regex intents)            │
│      ├─ local intents → dispatchIntent()                                   │
│      │    ├─ systemHandler  (volume, apps, screenshot, timer, time,       │
│      │    │                 weather)                                       │
│      │    ├─ mediaHandler   (Spotify / YouTube, playback keys)             │
│      │    └─ searchHandler  (web search, image search → browser)           │
│      └─ catch-all ai_query → aiClient.askClaude() → Gemini API             │
│                  └─ responseBuilder → { action, result, speak, state }     │
└────────────────────────────────────────────────────────────────────────────┘
```

**The command pipeline:**

1. **Capture** — the browser/Electron renderer captures speech with the Web Speech API (or you type it). The `"hey nimo"` wake word is stripped.
2. **Proxy** — the `nimo-os` Express server forwards the transcript to the backend at `http://localhost:3001/api/run-command` (30 s timeout).
3. **Parse** — `core/commandParser.js` walks `core/intentMap.js` in order; the first regex match wins (specific intents like `set_timer` come before broad catchers like `open_app`; `ai_query` is always last).
4. **Dispatch** — the intent is routed to a local service (system, media, search) or, as a catch-all, to Gemini with the conversation history.
5. **Respond** — a `{ action, result, speak, state }` envelope comes back; the UI animates the robot face, shows results/logs, and speaks the response aloud.

The backend also works **without Electron** — a standalone `server.js` exposes the same HTTP API for the web UI, so you can run it purely as a web app.

---

## 📋 Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- **npm 9+**
- **Windows 10/11, macOS 12+, or Linux** (X11/Wayland)
- A **Gemini API key** — get one at [Google AI Studio](https://aistudio.google.com/apikey)
- *(Optional)* An **ElevenLabs API key** for premium TTS

> ⚠️ Voice recognition uses the browser's Web Speech API, which is fully supported in Chrome/Edge (Electron works too). Other browsers may fall back to text input only.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
# Backend
cd nimo-backend
npm install

# UI
cd ../nimo-os
npm install
```

### 2. Configure environment variables

```bash
# Backend
cd nimo-backend
cp .env.example .env
# edit .env → set GEMINI_API_KEY
# optionally set ELEVENLABS_API_KEY
```

`.env.example` (backend) reference:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini key — on first launch it's migrated to the OS keychain and blanked from `.env` |
| `ELEVENLABS_API_KEY` | ➖ | ElevenLabs TTS key (falls back to browser SpeechSynthesis) |
| `ELEVENLABS_VOICE_NAME` | ➖ | Voice name, default `Eva - Futuristic Robot Helper` |
| `ELEVENLABS_MODEL_ID` | ➖ | Default `eleven_multilingual_v2` |
| `NODE_ENV` | ➖ | `development` or `production` |
| `HTTP_SERVER_PORT` | ➖ | Backend port, default `3001` |

```bash
# UI
cd ../nimo-os
cp .env.example .env
```

`.env.example` (UI) reference:

| Variable | Required | Description |
|---|---|---|
| `NIMO_BACKEND_URL` | ➖ | Backend URL, default `http://localhost:3001` |
| `APP_URL` | ➖ | Where nimo-os is hosted, default `http://localhost:3000` |

---

## ▶️ Running the Project

### Option A — Full desktop app (development)

```bash
cd nimo-backend
npm run dev
```

This launches both at once via `concurrently`:
- the **UI dev server** (`nimo-os`) on `http://localhost:3000`
- the **Electron app**, which loads the dev server in a frameless window

### Option B — Web app without Electron

```bash
# Terminal 1 — backend HTTP server
cd nimo-backend
node server.js        # listens on http://localhost:3001

# Terminal 2 — UI
cd nimo-os
npm run dev           # serves UI + API proxy on http://localhost:3000
```

Then open **http://localhost:3000** in your browser.

### Option C — Electron production shell only

```bash
cd nimo-backend
npm start             # electron . — loads ../nimo-os/dist (build the UI first)
```

---

## 🏗️ Building for Distribution

```bash
cd nimo-backend
npm run build
```

This builds the UI (`vite build`) and packages the Electron app with **electron-builder**, producing:
- **Windows** — NSIS installer `.exe`
- **macOS** — `.dmg`
- **Linux** — `.AppImage`

Icons are expected at `nimo-backend/assets/icon.ico` / `.icns` / `.png`.

---

## 🧪 Tests & Checks

```bash
cd nimo-backend
npm test              # node --test (intent map, dispatch, handlers)
npm run typecheck     # syntax-validates all backend JS files

cd ../nimo-os
npm run lint          # tsc --noEmit
```

---

## 🔌 API Reference

### NIMO backend (`http://localhost:3001`)

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `GET` | `/api/health` | – | `{ ok, service, ts }` |
| `POST` | `/api/run-command` | `{ transcript, personality?, intent? }` | `{ ok, action, result, speak, state, openUrl?, timer?, stop? }` |
| `POST` | `/api/tts` | `{ text, opts? }` | ElevenLabs audio data |

### nimo-os server (`http://localhost:3000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/logs` | Event log buffer + timers |
| `POST` | `/api/logs/add` | Append a log entry |
| `POST` | `/api/logs/clear` | Clear the log |
| `POST` | `/api/run-command` | Proxy to backend |
| `POST` | `/api/tts` | Proxy to backend TTS |

### Electron IPC (UI ↔ main, via `window.nimo.invoke`)

Channels include `nimo:run-command`, `nimo:ai-query`, `nimo:set-volume`, `nimo:open-app`, `nimo:play-music`, `nimo:web-search`, `nimo:take-screenshot`, `nimo:set-timer`, `nimo:cancel-timer`, `nimo:list-timers`, `nimo:get-time`, `nimo:get-weather`, `nimo:save-api-key`, `nimo:has-api-key`. Main-process events: `nimo:timer-done`, `nimo:state-change`, `nimo:speak`, `nimo:config`. See `nimo-backend/README.md` for the full table.

---

## 🗂️ Project Structure

```text
nimo_voice_assistant_app/
├── nimo-backend/            # Electron + Node backend
│   ├── electron/            # main.js (window/tray/HTTP server), preload.js, ipc/ handlers
│   ├── core/                # commandParser, intentMap, aiClient (Gemini), responseBuilder
│   ├── services/
│   │   ├── system/          # appLauncher, volumeControl, screenshotter, timerManager, ...
│   │   ├── media/           # spotifyHandler, youtubeHandler
│   │   ├── web/             # searchService (Google/DDG/Bing + image search)
│   │   ├── speech/          # recognizer, synthesizer (renderer-side)
│   │   └── tts/             # elevenLabsTts
│   ├── config/              # constants.js (all tunables), keystore.js (keytar)
│   ├── utils/               # logger, errorHandler, osDetect
│   ├── server.js            # standalone HTTP server (no Electron)
│   ├── test/                # node:test suites
│   └── assets/              # icons
├── nimo-os/                 # React + Vite UI
│   ├── src/App.tsx          # robot-face UI, voice, logs, settings, personality
│   ├── server.ts            # Express server + /api proxies
│   └── vite.config.ts
└── docs/                    # Architecture, PRD, design & phase docs
```

---

## 🔒 Security Notes

- **Never commit `.env` files or API keys.** Only `.env.example` files belong in git.
- The backend **migrates API keys into the OS keychain** via `keytar` on first launch and blanks them from the environment.
- The Electron renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and only whitelisted IPC channels are exposed through the `contextBridge`.
- Rotate API keys immediately if they were ever exposed.

---

## 📝 License

MIT
