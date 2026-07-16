/**
 * electron/ipc/searchHandler.js
 * IPC handlers for web search actions.
 */

const { ipcMain } = require('electron')
const logger = require('../../utils/logger')
const { format } = require('../../utils/errorHandler')

const searchService = require('../../services/web/searchService')
const constants = require('../../config/constants')

function registerSearchHandlers() {
  ipcMain.handle('nimo:web-search', async (_e, { query, engine } = {}) => {
    try {
      if (!query || !query.trim()) return format(new Error('No search query supplied.'), 'SEARCH')
      const resolvedEngine = engine || constants.DEFAULT_SEARCH_ENGINE
      const res = await searchService.openSearch(query, resolvedEngine)
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'SEARCH')
    }
  })
}

module.exports = { registerSearchHandlers }
