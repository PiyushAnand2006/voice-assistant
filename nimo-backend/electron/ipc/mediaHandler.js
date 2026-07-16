/**
 * electron/ipc/mediaHandler.js
 * IPC handlers for music / media actions.
 */

const { ipcMain } = require('electron')
const logger = require('../../utils/logger')
const { format } = require('../../utils/errorHandler')

const spotifyHandler = require('../../services/media/spotifyHandler')
const youtubeHandler = require('../../services/media/youtubeHandler')
const constants = require('../../config/constants')

function registerMediaHandlers() {
  /**
   * payload: { query: string, service?: 'spotify'|'youtube' }
   */
  ipcMain.handle('nimo:play-music', async (_e, { query, service } = {}) => {
    try {
      if (!query || !query.trim()) return format(new Error('No music query supplied.'), 'MEDIA')
      const svc = service || constants.DEFAULT_MUSIC_SERVICE
      let res
      if (svc === 'youtube') {
        res = await youtubeHandler.openYouTube(query)
      } else {
        res = await spotifyHandler.openSpotify(query)
      }
      return { ok: true, data: res }
    } catch (err) {
      return format(err, 'MEDIA')
    }
  })
}

module.exports = { registerMediaHandlers }
