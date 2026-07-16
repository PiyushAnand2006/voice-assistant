/**
 * tests/handlers.test.js
 * Unit tests for URL builders and response envelope builders.
 *
 * Run with:  node --test
 */

const test = require('node:test')
const assert = require('node:assert/strict')

const youtube = require('../services/media/youtubeHandler')
const search = require('../services/web/searchService')
const response = require('../core/responseBuilder')

test('youtube buildSearchUrl uses the reliable results page with encoded query', () => {
  const url = youtube.buildSearchUrl('bohemian rhapsody')
  assert.ok(url.startsWith('https://www.youtube.com/results?search_query='))
  // The query must be a single encoded string, not split into separate words.
  assert.ok(url.includes('bohemian%20rhapsody'), 'spaces must be encoded as %20, not broken apart')
  assert.ok(!url.includes(' '), 'URL must not contain raw spaces')
})

test('youtube buildSearchUrl handles a long phrase', () => {
  const url = youtube.buildSearchUrl('the longest song in the world official audio')
  assert.ok(url.includes('the%20longest%20song%20in%20the%20world%20official%20audio'))
})

test('searchService google url encodes the whole query', () => {
  const url = search.SEARCH_URLS.google('how to fix a leaky faucet')
  assert.ok(url.includes('how%20to%20fix%20a%20leaky%20faucet'))
  assert.ok(!url.includes(' '))
})

test('searchService duckduckgo url encodes the whole query', () => {
  const url = search.SEARCH_URLS.duck('best pizza near me')
  assert.ok(url.includes('best%20pizza%20near%20me'))
})

test('response.playMusic success envelope', () => {
  const env = response.playMusic({ success: true, query: 'dandelions', service: 'youtube' }, 'youtube')
  assert.equal(env.action, 'play_music')
  assert.equal(env.state, 'music')
  assert.equal(env.speak, 'Playing dandelions on youtube.')
})

test('response.playMusic failure envelope', () => {
  const env = response.playMusic({ success: false, query: 'x' }, 'youtube')
  assert.equal(env.state, 'error')
  assert.match(env.speak, /couldn't play/i)
})

test('response.openUrl includes openUrl field', () => {
  const env = response.openUrl('https://www.youtube.com', 'youtube')
  assert.equal(env.action, 'open_url')
  assert.equal(env.openUrl, 'https://www.youtube.com')
  assert.equal(env.state, 'happy')
})

test('response.mediaControl envelope', () => {
  const env = response.mediaControl('next', 'Skipping to the next track.')
  assert.equal(env.action, 'media_control')
  assert.equal(env.media.action, 'next')
  assert.equal(env.state, 'music')
})

test('response.webSearch envelope', () => {
  const env = response.webSearch({ success: true, query: 'cats', engine: 'google', url: 'https://google.com/search?q=cats', results: [{ title: 'Cats', url: 'https://example.com', snippet: 'meow' }] }, 'google')
  assert.equal(env.action, 'web_search')
  assert.match(env.speak, /Searching google for cats/)
  assert.ok(Array.isArray(env.results))
  assert.equal(env.results.length, 1)
  assert.equal(env.openUrl, 'https://google.com/search?q=cats')
})

test('parseDdgResults extracts titles, urls and snippets', () => {
  const html = `
    <div class="result results_links_deep highlight_d result--url-above-snippet">
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;abc=1">Example Page</a>
      <a class="result__snippet" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">This is a snippet about the example.</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://another.com">Another</a>
    </div>`
  const results = search.parseDdgResults(html, 5)
  assert.ok(results.length >= 1)
  assert.equal(results[0].title, 'Example Page')
  assert.equal(results[0].url, 'https://example.com/page')
  assert.match(results[0].snippet, /snippet about the example/)
})

test('response.setTimer envelope', () => {
  const env = response.setTimer({ minutes: 5, label: 'Timer' })
  assert.equal(env.action, 'set_timer')
  assert.match(env.speak, /Timer set for 5 minutes/)
})

test('response.build spreads extra fields', () => {
  const env = response.build('x', { a: 1 }, 'hi', 'idle', { openUrl: 'https://example.com' })
  assert.equal(env.openUrl, 'https://example.com')
})
