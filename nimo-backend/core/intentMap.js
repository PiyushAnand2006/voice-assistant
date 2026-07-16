/**
 * core/intentMap.js
 * Ordered list of local intents. The command parser walks this list in order;
 * the FIRST intent whose pattern matches wins. The catch-all `ai_query`
 * intent must always be last so unmatched text falls through to Claude.
 *
 * Each `params` function receives the regex match object and returns the
 * extracted params object passed to dispatchIntent().
 *
 * ORDERING RULE: More specific intents (get_time, get_date, set_timer,
 * set_volume, volume_*) MUST appear before broader catchers like web_search
 * and the trailing ai_query, otherwise greedy patterns mask them.
 */

const constants = require('../config/constants')

const ints = [
  // --- Most specific first ---------------------------------------------

  {
    // Image search must come BEFORE play_music so "show me images of X" or a
    // misheard "play images" doesn't get sent to YouTube.
    name: 'image_search',
    patterns: [
      /(?:show|find|search|look|get|give|open|play)(?:\s+me)?\s+(?:some\s+)?(?:pictures|photos|images|image|pics)\s+(?:of|for|about|on)?\s*(.+)?/i,
      /(?:show|find|search|look|get|give|open|play)(?:\s+me)?\s+(.+?)\s+(?:pictures|photos|images|image|pics)/i,
      /image\s+search(?:\s+for)?\s+(.+)/i,
      /google\s+images?(?:\s+for)?\s+(.+)/i
    ],
    params: (m) => {
      const raw = (m[1] || '').trim()
      // If no subject captured (e.g. bare "show images"), default to a generic query.
      return { query: raw || 'images' }
    },
    // Don't let a bare "play images" fall through here; only image-y phrasing.
    exclude: (transcript) => !/(image|images|picture|pictures|photo|photos|pics)/i.test(transcript)
  },
  {
    name: 'play_music',
    patterns: [/play (.+)/i, /put on (.+)/i, /listen to (.+)/i],
    params: (m) => ({ query: m[1].trim() }),
    // "play images / play video / play cat" should NOT open YouTube.
    exclude: (transcript) => /(image|images|picture|pictures|photo|photos|pics|video|videos|movie|movies|clip|clips)/i.test(transcript)
  },
  {
    name: 'open_youtube',
    patterns: [/open youtube/i, /go to youtube/i, /launch youtube/i, /open up youtube/i, /youtube\s+app/i, /^youtube$/i],
    // Avoid stealing "open <app>" commands that are not about YouTube.
    exclude: (transcript) => !/youtube/i.test(transcript)
  },
  {
    name: 'music_next',
    patterns: [/next song/i, /next track/i, /skip(?: this| the)? song/i, /skip(?: to)? the next/i, /play next/i, /next\b/i],
    exclude: (transcript) => /youtube|spotify|app|tab/i.test(transcript)
  },
  {
    name: 'music_previous',
    patterns: [/previous song/i, /previous track/i, /last song/i, /go back(?: a)? song/i, /play previous/i, /back(?: a)? track/i],
    exclude: (transcript) => /youtube|spotify|app|tab/i.test(transcript)
  },
  {
    name: 'music_pause',
    patterns: [/pause(?: the)? music/i, /pause(?: the)? song/i, /pause(?: the)? playback/i, /pause/i],
    exclude: (transcript) => /youtube|spotify|app|tab|timer|after/i.test(transcript)
  },
  {
    name: 'music_resume',
    patterns: [/resume(?: the)? music/i, /continue(?: the)? music/i, /resume(?: the)? song/i, /unpause/i, /play(?: the)? music/i, /start(?: the)? music/i, /play again/i, /resume/i],
    exclude: (transcript) => /youtube|spotify|app|tab|next|previous|on |search|for /i.test(transcript)
  },
  {
    name: 'set_timer',
    // Matches:
    //   "set timer for 5 minutes"
    //   "start a timer for 3 minutes and 30 seconds"
    //   "timer for 10 min"
    // Minutes-unit is required (min|minute|minutes). Seconds clause optional.
    // Order matters: examine "and a half" first so the seconds clause does not swallow it.
    patterns: [
      /(?:set|start)(?:\s+a)?\s+timer(?:\s+for)?\s+(\d+)\s*(?:minutes?|mins?)\s+and\s+a\s+half/i,
      /(?:set|start)(?:\s+a)?\s+timer(?:\s+for)?\s+(\d+)\s+(?:minutes?|mins?)\s+and\s+(\d+)\s*(?:seconds?|secs?)/i,
      /(?:set|start)(?:\s+a)?\s+timer(?:\s+for)?\s+(\d+)\s*(?:minutes?|mins?)/i
    ],
    params: (m) => {
      const mins = parseInt(m[1], 10) || 0
      const secs = parseInt(m[2] || '0', 10) || 0
      let total = mins + secs / 60
      if (/a\s+half/i.test(m[0])) total += 0.5
      return { minutes: total }
    }
  },
  {
    name: 'get_time',
    patterns: [/what(?:'s| is) the time/i, /what time is it/i, /current time/i, /time now/i, /tell me the time/i]
  },
  {
    name: 'get_date',
    patterns: [/what(?:'s| is) (?:today's )?date/i, /what day is it/i, /what(?:'s| is)(?: the)? date/i, /tell me the date/i]
  },
  {
    name: 'volume_up',
    patterns: [/volume up/i, /louder/i, /turn it up/i, /increase volume/i, /raise the volume/i]
  },
  {
    name: 'volume_down',
    patterns: [/volume down/i, /quieter/i, /turn it down/i, /decrease volume/i, /lower the volume/i]
  },
  {
    name: 'set_volume',
    patterns: [/set volume to (\d+)/i, /volume(?: to)? (\d+)/i, /turn volume to (\d+)/i],
    params: (m) => ({ value: parseInt(m[1], 10) })
  },
  {
    name: 'screenshot',
    patterns: [/take a screenshot/i, /screenshot/i, /capture screen/i, /grab the screen/i]
  },
  {
    name: 'get_weather',
    patterns: [/weather(?: in| for)? (.+)/i, /how(?:'s| is) the weather/i, /temperature(?: in| for)? (.+)/i],
    params: (m) => ({ city: m[1]?.trim() || null })
  },
  {
    name: 'stop',
    patterns: [/^stop$/i, /^cancel$/i, /never mind/i, /forget it/i, /shut up/i]
  },

  // --- Broader catchers (after specific) -------------------------------

  {
    name: 'open_app',
    patterns: [/open (.+)/i, /launch (.+)/i, /start (.+)/i],
    // Avoid treating "start a timer for 5 minutes" as app launch; let set_timer win.
    params: (m) => ({ appName: m[1].trim() }),
    exclude: (transcript) => /timer|alarm|meeting/i.test(transcript)
  },
  {
    // NOTE: deliberately omits the greedy "what's X" pattern — that is handled
    // by the trailing ai_query catch-all so questions like "what's the capital
    // of France" get a conversational answer from Claude instead of a web
    // search, which is more in keeping with NIMO's personality.
    name: 'web_search',
    patterns: [/search(?: for)? (.+)/i, /google (.+)/i, /look up (.+)/i, /find (?:me )?(?:info about|information about) (.+)/i],
    params: (m) => ({ query: m[1].trim() })
  },

  // --- Catch-all — MUST be last ----------------------------------------

  {
    name: 'ai_query',
    patterns: [/.+/],
    params: (m) => ({ text: m.input.trim() })
  }
]

// Internal helper: strip a leading wake word ("hey nimo, ...") if present.
function stripWake(text) {
  const ww = constants.WAKE_WORD.toLowerCase()
  const lower = text.toLowerCase()
  if (lower.startsWith(ww)) {
    return text.slice(ww.length).replace(/^[,\s]+/, '').trim()
  }
  return text.trim()
}

module.exports = { intents: ints, stripWake }
