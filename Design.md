# NIMO OS — Design Document

## 1. Color Palette

| Name | Hex | Usage |
|---|---|---|
| Primary Cyan | `#00E8D6` | Accent, glows, active states, idle face |
| Surface Black | `#050507` | Window background, deepest layer |
| Near-Black | `#0A0A0D` | Card surfaces, sidebar backgrounds |
| State: Thinking | `#3B9EFF` | Blue-Cyan gradient for processing states |
| State: Happy | `#00E8A0` | Cyan-Green for success / happy expressions |
| State: Music | `#FFB020` | Amber for music playback indicators |
| State: Error | `#FF4D4D` | Red for errors, failures, warning states |
| State: Listening | `#00E8D6` | Cyan pulse animation (listening) |
| State: Confused | `#FF9F40` | Amber-orange for unrecognized commands |
| Text Primary | `#FFFFFF` | Main readable text |
| Text Muted | `#6B7280` | Timestamps, secondary labels |

---

## 2. Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| Event Log (sidebar) | `JetBrains Mono` / `Fira Code` / monospace | 400 | 12px |
| System status labels | `Inter` / `SF Pro` / system-ui | 500 | 11px |
| Error messages (TTS) | System prompt enforces short sentences — no font needed | — | — |
| App name / title | `Inter` / `SF Pro` / system-ui | 700 | 14px |

*Note: Typography in the backend shell is minimal — all rendering is done by the Stitch UI. The renderer receives only `{ speak, state }` from IPC and uses the Stitch UI's own font stack.*

---

## 3. Visual Style

| Attribute | Value |
|---|---|
| Overall aesthetic | Cybernetic, dark-mode, high-contrast |
| Corner radius | 16px (outer window), 64px (eye modules) |
| Shadows | Minimal — the robot face should feel like a lit hardware screen |
| State animations | 0.2s CSS transitions on eye morph properties (height, rotation, border-radius) |
| Transparency | Frameless window with `transparent: true` — relies on Stitch UI having solid dark backgrounds |
| Spacing unit | 8px base grid |

---

## 4. Robot Face States & Mappings

The Stitch UI renders the face based on the `state` string received via `nimo:state-change`.

| State string | Eye shape | Color | Mouth |
|---|---|---|---|
| `idle` | Rounded rectangles, 64×80px, resting | `#00E8D6` | Closed arc |
| `listening` | Wider, slight pulse animation | `#00E8D6` + glow | Small open oval |
| `thinking` | Narrower, tilted inward, animated dots | `#3B9EFF` | Flat line |
| `talking` | Normal rounded, slight bounce | `#00E8D6` | Animated wave/oval |
| `happy` | Wide, tall, corners lifted (rotation) | `#00E8A0` | Smile arc |
| `confused` | Asymmetric height (one taller) | `#FF9F40` | Wavy line |
| `error` | Flat, compressed height | `#FF4D4D` | Downturned arc |
| `music` | Tall, very rounded, slight bounce | `#FFB020` | Open singing oval |

---

## 5. Window & Tray Design

| Property | Value |
|---|---|
| Window size | 320 × 520 px |
| Window style | Frameless, transparent, non-resizable, non-maximizable |
| Always on top | `alwaysOnTop: true, level: 'screen-saver'` |
| Tray icon | `assets/icon.png` (fallback: 16×16 cyan square in-memory buffer) |
| Tray tooltip | "NIMO — voice assistant" |
| Tray menu | Show NIMO / Hide NIMO / Quit |
| Tray click | Toggle show/hide |
| Dev vs prod UI | `NODE_ENV=development` → `http://localhost:3000`; else `./ui/index.html` |

---

## 6. Event Log Design (Sidebar)

The right-hand sidebar in the Stitch UI displays real-time events.

| Event type | Log format | Color |
|---|---|---|
| System init | `[HH:MM:SS] Initialized {module}` | `#6B7280` |
| Voice engine status | `[HH:MM:SS] Speech engine ready` | `#00E8D6` |
| Intent parsed | `[HH:MM:SS] → {intent}: {params JSON}` | `#00E8D6` |
| Claude response | `[HH:MM:SS] ← Claude: {text}` | `#3B9EFF` |
| Action result | `[HH:MM:SS] ✓ {action} → {result}` | `#00E8A0` |
| Error | `[HH:MM:SS] ✗ {code}: {error}` | `#FF4D4D` |
| Timer done | `[HH:MM:SS] ⏰ {label} is done!` | `#FFB020` |

---

## 7. TTS Voice Selection (Renderer Synthesizer)

The `synthesizer.js` in the renderer selects a voice using this heuristic:

1. Prefer a "natural" English voice (names containing `Google`, `Samantha`, `Aria`, `Jenny`, `David`, `Microsoft`).
2. Fall back to any English (`lang` starts with `en`) voice.
3. Fall back to the first available voice.
4. `rate = 1.05`, `pitch = 1.0`, `lang = en-US` (all configurable via `NIMO_CONFIG` from main).

---

## 8. Icon Assets Needed

| File | Size | Format | Platform |
|---|---|---|---|
| `assets/icon.png` | 256×256 minimum | PNG | Source / Linux AppImage |
| `assets/icon.ico` | 256×256, multiple resolutions | ICO | Windows NSIS + tray |
| `assets/icon.icns` | 512×512 | ICNS | macOS DMG + tray |