/**
 * tests/intentMap.test.js
 * Unit tests for the intent-matching pipeline (intentMap + commandParser).
 *
 * Run with:  node --test
 */

const test = require('node:test')
const assert = require('node:assert/strict')

const { parseCommand, extractParams } = require('../core/commandParser')
const { intents } = require('../core/intentMap')

// Helper: parse and return the intent name (or null)
function intentOf(transcript) {
  const p = parseCommand(transcript)
  return p ? p.intent : null
}
function paramsOf(transcript) {
  const p = parseCommand(transcript)
  return p ? p.params : null
}

test('play_music captures the query (service qualifier kept until dispatch)', () => {
  const r = parseCommand('play dandelions on youtube')
  assert.equal(r.intent, 'play_music')
  // The parser captures the raw query; dispatchIntent strips the "on youtube"
  // service qualifier so the song name is what gets searched.
  assert.equal(r.params.query, 'dandelions on youtube')
})

test('play_music keeps a full song + artist phrase intact', () => {
  const r = parseCommand('play bohemian rhapsody by queen')
  assert.equal(r.intent, 'play_music')
  assert.equal(r.params.query, 'bohemian rhapsody by queen')
})

test('play_music captures spotify query with qualifier', () => {
  const r = parseCommand('play summers of 69 on spotify')
  assert.equal(r.intent, 'play_music')
  assert.equal(r.params.query, 'summers of 69 on spotify')
})

test('open_youtube matches explicit open commands', () => {
  assert.equal(intentOf('open youtube'), 'open_youtube')
  assert.equal(intentOf('go to youtube'), 'open_youtube')
  assert.equal(intentOf('launch youtube'), 'open_youtube')
})

test('open_youtube does NOT steal a play command', () => {
  assert.equal(intentOf('play dandelions on youtube'), 'play_music')
})

test('open_youtube does NOT steal "open <other app>"', () => {
  assert.equal(intentOf('open notepad'), 'open_app')
})

test('music_next / previous / pause / resume match transport commands', () => {
  assert.equal(intentOf('next song'), 'music_next')
  assert.equal(intentOf('previous track'), 'music_previous')
  assert.equal(intentOf('pause'), 'music_pause')
  assert.equal(intentOf('resume the music'), 'music_resume')
})

test('music_pause is excluded when it looks like a timer pause', () => {
  // "pause after 5 minutes" should not be music_pause
  assert.notEqual(intentOf('pause after 5 minutes'), 'music_pause')
})

test('web_search captures the full query', () => {
  const r = parseCommand('search for best pizza places near me')
  assert.equal(r.intent, 'web_search')
  assert.equal(r.params.query, 'best pizza places near me')
})

test('image_search captures subject before "images"', () => {
  const r = parseCommand('show me some images of cats')
  assert.equal(r.intent, 'image_search')
  assert.equal(r.params.query, 'cats')
})

test('image_search handles "show pictures of X"', () => {
  const r = parseCommand('show pictures of mountains')
  assert.equal(r.intent, 'image_search')
  assert.equal(r.params.query, 'mountains')
})

test('play_music does NOT hijack "play images"', () => {
  assert.equal(intentOf('play some images'), 'image_search')
})

test('play_music does NOT hijack "play video"', () => {
  assert.equal(intentOf('play a video'), 'ai_query')
})

test('open_app captures full app name', () => {
  const r = parseCommand('open visual studio code')
  assert.equal(r.intent, 'open_app')
  assert.equal(r.params.appName, 'visual studio code')
})

test('set_timer parses minutes correctly', () => {
  const r = parseCommand('set timer for 5 minutes')
  assert.equal(r.intent, 'set_timer')
  assert.equal(r.params.minutes, 5)
})

test('set_timer parses "and a half"', () => {
  const r = parseCommand('start a timer for 5 minutes and a half')
  assert.equal(r.intent, 'set_timer')
  assert.equal(r.params.minutes, 5.5)
})

test('set_timer wins over open_app for "start a timer"', () => {
  assert.equal(intentOf('start a timer for 3 minutes'), 'set_timer')
})

test('get_time / get_date match', () => {
  assert.equal(intentOf('what time is it'), 'get_time')
  assert.equal(intentOf('what is the date'), 'get_date')
})

test('volume commands match', () => {
  assert.equal(intentOf('volume up'), 'volume_up')
  assert.equal(intentOf('volume down'), 'volume_down')
  assert.equal(intentOf('set volume to 40'), 'set_volume')
})

test('unmatched text falls through to ai_query', () => {
  assert.equal(intentOf('tell me a joke about cats'), 'ai_query')
})

test('wake word is stripped before matching', () => {
  const r = parseCommand('hey nimo play dandelions')
  assert.equal(r.intent, 'play_music')
  assert.equal(r.params.query, 'dandelions')
})

test('empty / invalid input returns null', () => {
  assert.equal(parseCommand(''), null)
  assert.equal(parseCommand(null), null)
  assert.equal(parseCommand(123), null)
})

test('intentMap always ends with the ai_query catch-all', () => {
  const last = intents[intents.length - 1]
  assert.equal(last.name, 'ai_query')
})

test('extractParams returns params for a known intent', () => {
  const params = extractParams('play my song here', 'play_music')
  assert.equal(params.query, 'my song here')
})
