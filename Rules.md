# NIMO OS — Rules & Constraints

## 1. Architecture Rules

| Rule | Rationale |
|---|---|
| Renderer is fully sandboxed (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`) | Prevent renderer from accessing Node APIs or the filesystem directly |
| All Node/Electron APIs live only in main process | Backend logic stays in main; renderer only sends/receives data |
| API key never reaches the renderer | Stored in OS keychain via `keytar`; only the main process holds `process.env.ANTHROPIC_API_KEY` |
| IPC channels are whitelisted in `preload.js` | Defense in depth: even if renderer is compromised, it cannot call arbitrary channels |
| No `eval()` or dynamic code generation | Security hardening |

---

## 2. Intent Parser Rules

| Rule | Rationale |
|---|---|
| Specific intents (get_time, set_timer, volume_*) must appear before broad catchers (web_search, ai_query) | Prevents greedy patterns like `what's the time` from matching `what(?:'s| is) (.+)` |
| `ai_query` is always last (anchored `/.+/`) | Guaranteed fallback; every transcript produces a response |
| Wake-word stripping is idempotent and only removes the leading occurrence | Prevents "hey nimo play music" from losing the "play music" command |
| Timer regex requires explicit time unit (`minutes?` / `mins?`) | Avoids "set a timer 5" being parsed as `mins=5` with no context |
| `open_app` has an `exclude` function that skips `timer\|alarm\|meeting` in the transcript | Prevents "start a timer" from accidentally launching an app named "a timer" |

---

## 3. AI / Claude Rules

| Rule | Enforcement |
|---|---|
| Max 2 short sentences per response | `AI_MAX_TOKENS: 300` caps output; system prompt instructs brevity |
| Never say "As an AI..." or "I cannot..." | System prompt instruction |
| Keep last 6 messages for context | `AI_HISTORY_LENGTH: 6` rolling window in `aiClient.js` |
| If API key is missing, surface a helpful message | `NimoError('NO_API_KEY', ...)` thrown before API call |
| API errors return `{ ok: false, speak: "I had trouble thinking…" }` | `errorHandler.format()` catches all Claude errors and normalizes them |

---

## 4. Error Handling Rules

| Rule | Implementation |
|---|---|
| All IPC handlers wrapped in `errorHandler.guard()` or explicit try/catch returning `format(err)` | Never throw raw errors to IPC; always return a normalized `{ ok, error, code, speak, state }` object |
| Native module load failures (keytar, loudness) are caught and degrade gracefully | `try/catch` around `require('keytar')` / `require('loudness')`; fallbacks active |
| `Notification` construction failures in timerManager are caught and logged | `try/catch` around `new Notification(...)`; timer still fires via IPC |
| Speech module (`recognizer.js`, `synthesizer.js`) guard with `typeof window !== 'undefined'` | Prevents Node.js top-level require crashes |
| `screenshotter.takeScreenshot()` validates thumbnail bytes before writing | Returns `NimoError` if PNG buffer is empty |

---

## 5. Logging Rules

| Rule | Detail |
|---|---|
| Log levels: debug, info, warn, error | Configured via `constants.LOG_LEVEL` (default `info`) |
| Log destination: `logs/nimo.log` (created automatically) | Falls back to `os.tmpdir()` if write fails |
| Sensitive data (API keys, paths) must NOT appear in log output | `errorHandler.spellableError()` strips file paths from TTS-error messages |
| Timestamps in ISO 8601 format | `[2026-07-15 10:03:30] [INFO] message` |

---

## 6. File / Module Rules

| Rule | Rationale |
|---|---|
| All `.js` files must pass `new Function(fs.readFileSync(...))` syntax check | Ensures no parse-time errors across all modules |
| Speech modules use IIFE wrapping with `typeof window !== 'undefined'` guard | They are browser-only but may be accidentally required in Node during development |
| No `console.log` in production code — use `logger.info/warn/error` | `logger` writes to file + conditionally to stdout |
| All `require()` calls use relative paths (`../../`, `../`) | Keeps the module graph portable |
| Constants that may differ per-install (API key, volume step) live in `config/constants.js` | Single place to change; no magic numbers scattered in services |

---

## 7. What NIMO Should NOT Do

- **Never** expose the raw Node `process` object to the renderer.
- **Never** log or surface an API key in any output.
- **Never** run `eval()` or load external code dynamically.
- **Never** make network requests to non-allowlisted domains (only: Anthropic API, wttr.in, Google/DuckDuckGo/Bing, Spotify/YouTube open URLs).
- **Never** assume a specific platform for shell commands without a fallback path.
- **Never** create files outside of `logs/`, `pictures/nimo-screenshots/`, or the app's own config directory.