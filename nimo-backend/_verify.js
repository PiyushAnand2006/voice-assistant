require('./services/system/browserLauncher').openInBrowser = async (url) => ({ success: true, url, browser: 'mock' });
require('./services/system/mediaKeys').mediaPlayPause = async () => ({ success: true, key: 'playpause' });
require('./services/system/mediaKeys').mediaNext = async () => ({ success: true, key: 'next' });
require('./services/system/mediaKeys').mediaPrevious = async () => ({ success: true, key: 'previous' });
const { parseCommand } = require('./core/commandParser');
const { dispatchIntent } = require('./electron/ipc');

const cases = [
  'play shape of you on spotify',
  'play shape of you on youtube',
  'play lofi beats',
  'open facebook',
  'open facebook.com',
  'open anthropic.com',
  'open target',
  'open instagram',
  'open youtube',
  'open calculator',
  'next song',
  'pause music'
];

(async () => {
  for (const t of cases) {
    const p = parseCommand(t);
    const e = await dispatchIntent(p.intent, p.params, null);
    const pend = e.pendingAction
      ? 'pending=' + e.pendingAction.type + ':' + (e.pendingAction.query || e.pendingAction.url || e.pendingAction.name || '')
      : '';
    console.log(
      t.padEnd(34),
      '->',
      (e.action || '').padEnd(13),
      'speak:', (e.speak || '').substring(0, 72),
      pend
    );
  }
  console.log('----- confirm flow -----');
  const pending = {
    type: 'play_music',
    service: 'youtube',
    query: 'shape of you',
    url: 'https://www.youtube.com/results?search_query=shape%20of%20you'
  };
  for (const ans of ['yes', 'no', 'yeah', 'nope']) {
    const p2 = parseCommand(ans, { pendingAction: pending });
    const e2 = await dispatchIntent(p2.intent, p2.params, null);
    console.log('confirm ' + ans, '->', e2.action, '| speak:', e2.speak);
  }
})();
