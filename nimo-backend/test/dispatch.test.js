/**
 * tests/dispatch.test.js
 * Integration test for dispatchIntent() music routing.
 * Stubs the browser launcher so no real Chrome window opens during tests.
 *
 * Run with:  node --test
 */

const test = require('node:test')
const assert = require('node:assert/strict')

// Stub the browser launcher BEFORE requiring dispatchIntent (which pulls in handlers).
const browserLauncher = require('../services/system/browserLauncher')
browserLauncher.openInBrowser = async (url) => ({ success: true, url, browser: 'stub' })

// Stub the media keys so no real PowerShell/keybd_event runs during tests.
const mediaKeys = require('../services/system/mediaKeys')
mediaKeys.mediaNext = async () => ({ success: true, key: 'next' })
mediaKeys.mediaPrevious = async () => ({ success: true, key: 'previous' })
mediaKeys.mediaPlayPause = async () => ({ success: true, key: 'playpause' })
mediaKeys.mediaStop = async () => ({ success: true, key: 'stop' })

const { dispatchIntent } = require('../electron/ipc/index')
const timerManager = require('../services/system/timerManager')

// set_timer schedules a real setTimeout that would keep the event loop alive;
// clear all timers after the suite so `node --test` can exit.
test.after(() => {
  try { timerManager.cancelAll() } catch { /* noop */ }
})

test('dispatchIntent play_music routes to youtube and returns music state', async () => {
  const env = await dispatchIntent('play_music', { query: 'dandelions on youtube' }, null)
  assert.equal(env.action, 'play_music')
  assert.equal(env.state, 'music')
  assert.match(env.speak, /Playing dandelions on youtube/)
  assert.ok(env.result.url.includes('youtube.com/results'))
  assert.ok(env.result.url.includes('dandelions'))
  // openUrl is surfaced so the frontend can also open it.
  assert.ok(env.openUrl && env.openUrl.includes('dandelions'))
})

test('dispatchIntent play_music routes spotify query to spotify url', async () => {
  const env = await dispatchIntent('play_music', { query: 'summers of 69 on spotify' }, null)
  assert.equal(env.action, 'play_music')
  assert.ok(env.result.url.includes('open.spotify.com'))
  assert.ok(env.result.url.includes('summers%20of%2069'))
})

test('dispatchIntent open_youtube returns the youtube home url', async () => {
  const env = await dispatchIntent('open_youtube', {}, null)
  assert.equal(env.action, 'open_url')
  assert.equal(env.openUrl, 'https://www.youtube.com')
})

test('dispatchIntent web_search returns search envelope', async () => {
  const env = await dispatchIntent('web_search', { query: 'how to train a dragon' }, null)
  assert.equal(env.action, 'web_search')
  assert.ok(env.result.url.includes('google.com/search'))
  assert.ok(env.result.url.includes('how%20to%20train%20a%20dragon'))
})

test('dispatchIntent music_pause returns a media_control envelope', async () => {
  const env = await dispatchIntent('music_pause', {}, null)
  assert.equal(env.action, 'media_control')
  assert.equal(env.media.action, 'pause')
})

test('dispatchIntent set_timer returns set_timer envelope', async () => {
  const env = await dispatchIntent('set_timer', { minutes: 3 }, null)
  assert.equal(env.action, 'set_timer')
  assert.match(env.speak, /Timer set for 3 minutes/)
})

test('dispatchIntent unknown intent returns confused envelope', async () => {
  const env = await dispatchIntent('does_not_exist', {}, null)
  assert.equal(env.state, 'confused')
})
