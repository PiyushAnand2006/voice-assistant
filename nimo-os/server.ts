import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const app = express();
const PORT = 3000;
const NIMO_BACKEND = process.env.NIMO_BACKEND_URL || "http://localhost:3001";

app.use(express.json());

// ── Logging helpers ──────────────────────────────────────────────────────────

interface ServerLog {
  id: string;
  timestamp: string;
  type: string;
  text: string;
  category: 'info' | 'voice' | 'intent' | 'ai' | 'action' | 'error';
}

const logs: ServerLog[] = [];

function addLog(text: string, type = "CLIENT", category: ServerLog['category'] = "info") {
  const ts = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry: ServerLog = { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: ts, type, text, category };
  logs.unshift(entry);
  if (logs.length > 200) logs.pop();
}

function postLog(text: string, type: string, category: ServerLog['category']) {
  addLog(text, type, category);
}

// Seed with startup log so the event log panel is never empty on first load.
addLog("Connected to NIMO backend on " + NIMO_BACKEND, "SYS_INIT", "info");
addLog("NIMO SYSTEM: All handlers active", "SYS_READY", "info");

// ── API routes ──────────────────────────────────────────────────────────────

// GET /api/logs — returns event log buffer (timers array is always empty;
// timer display is driven by the NIMO backend push events in the renderer).
app.get("/api/logs", (_req, res) => {
  res.json({ logs, timers: [] });
});

app.post("/api/logs/add", (req, res) => {
  const { text, type, category } = req.body || {};
  if (text) postLog(String(text), type || "CLIENT", category || "info");
  res.json({ ok: true });
});

app.post("/api/logs/clear", (req, res) => {
  logs.length = 0;
  addLog("Event log cleared.", "SYSTEM", "info");
  res.json({ ok: true });
});

// POST /api/run-command — proxy to NIMO backend (Electron main process).
// All intent parsing, Claude AI, and system actions are handled by the
// nimo-backend HTTP server on port 3001. This proxy forwards the request
// and returns the { action, result, speak, state, openUrl?, timer? } envelope
// that the nimo-os frontend expects.
app.post("/api/run-command", async (req, res) => {
  const { transcript, personality } = req.body || {};
  if (!transcript || !String(transcript).trim()) {
    return res.status(400).json({ ok: false, error: "Transcript is empty" });
  }
  addLog(`User command: "${transcript}"`, "HEARD", "voice");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 s timeout

    const backendRes = await fetch(`${NIMO_BACKEND}/api/run-command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, personality: personality || "friendly" }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!backendRes.ok) {
      throw new Error(`Backend responded with ${backendRes.status}`);
    }

    const data = await backendRes.json() as any;

    if (data.speak) {
      addLog(`NIMO: "${data.speak}"`, "REPLY", "ai");
    }
    if (data.action) {
      addLog(`Action: [${data.action.toUpperCase()}]`, "INTENT", "intent");
    }

    return res.json(data);
  } catch (err: any) {
    addLog(`Backend proxy error: ${err.message}`, "PROXY_ERR", "error");
    return res.json({
      ok: false,
      action: "proxy_error",
      result: err.message,
      speak: "I couldn't reach the NIMO backend. Is it running?",
      state: "error"
    });
  }
});

// POST /api/tts — proxy to NIMO backend for ElevenLabs TTS.
app.post("/api/tts", async (req, res) => {
  const { text, opts } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: "Text is empty" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const backendRes = await fetch(`${NIMO_BACKEND}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, opts }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!backendRes.ok) {
      throw new Error(`Backend TTS responded with ${backendRes.status}`);
    }

    const data = await backendRes.json();
    return res.json(data);
  } catch (err: any) {
    addLog(`TTS proxy error: ${err.message}`, "TTS_ERR", "error");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Vite dev server + startup ───────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NIMO-OS] UI server running on http://localhost:${PORT}`);
    console.log(`[NIMO-OS] Proxying /api/run-command → ${NIMO_BACKEND}/api/run-command`);
  });
}

startServer();