/**
 * electron/preload.js
 * Context bridge: exposes a tightly-scoped `window.nimo` API to the renderer.
 *
 * No Node/Electron modules are exposed directly — only the three safe
 * primitives the UI needs: invoke (request/response), on (subscribe), off
 * (unsubscribe).
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Whitelist of channels the renderer is allowed to invoke (request/response).
 */
const INVOKABLE = new Set([
  'nimo:run-command',
  'nimo:ai-query',
  'nimo:set-volume',
  'nimo:open-app',
  'nimo:play-music',
  'nimo:web-search',
  'nimo:take-screenshot',
  'nimo:set-timer',
  'nimo:cancel-timer',
  'nimo:list-timers',
  'nimo:get-time',
  'nimo:get-weather',
  'nimo:save-api-key',
  'nimo:has-api-key',
  'nimo:state-event'
])

/**
 * Whitelist of channels the main process may send TO the renderer.
 */
const RENDERABLE = new Set([
  'nimo:timer-done',
  'nimo:state-change',
  'nimo:speak',
  'nimo:config'
])

const invoker = (channel, data) => {
  if (INVOKABLE.has(channel)) {
    return ipcRenderer.invoke(channel, data)
  }
  return Promise.reject(new Error(`Blocked invoke on disallowed channel: ${channel}`))
}

const subscriber = (channel, cb) => {
  if (!RENDERABLE.has(channel)) {
    return () => {}
  }
  const wrapper = (_event, data) => cb(data)
  ipcRenderer.on(channel, wrapper)
  // Return an unsubscribe fn for ergonomic teardown.
  return () => ipcRenderer.removeListener(channel, wrapper)
}

const remover = (channel, cb) => {
  if (RENDERABLE.has(channel)) ipcRenderer.removeListener(channel, cb)
}

contextBridge.exposeInMainWorld('nimo', {
  invoke: invoker,
  on: subscriber,
  off: remover
})
