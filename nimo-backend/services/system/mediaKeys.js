/**
 * services/system/mediaKeys.js
 * Sends hardware media keys to the OS so media playback (in any focused app)
 * can be controlled globally.
 *
 *   mediaNext()      → VK_MEDIA_NEXT_TRACK   (0xB0)
 *   mediaPrevious()  → VK_MEDIA_PREV_TRACK   (0xB1)
 *   mediaPlayPause() → VK_MEDIA_PLAY_PAUSE   (0xB3)
 *   mediaStop()      → VK_MEDIA_STOP         (0xB2)
 *
 * Implementation:
 *   Windows: uses PowerShell + user32::keybd_event (extended key down + up).
 *   macOS / Linux: graceful no-op with a logged warning.
 *
 * Returns: { success: boolean, key: string, error?: string }
 */

const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const logger = require('../../utils/logger')

function isWindows() { return process.platform === 'win32' }

function runPowerShellScript(scriptContent) {
  return new Promise((resolve) => {
    const tempFilePath = path.join(os.tmpdir(), `nimo-media-${Date.now()}.ps1`)
    fs.writeFileSync(tempFilePath, scriptContent)
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempFilePath], { timeout: 5000 }, (err) => {
      fs.unlinkSync(tempFilePath) // Cleanup
      resolve(!err)
    })
  })
}

// keybd_event virtual keycodes for the media keys.
const VK = {
  mediaNextTrack: 0xB0,
  mediaPrevTrack: 0xB1,
  mediaPlayPause: 0xB3,
  mediaStop: 0xB2
}

/**
 * Synthesise a single media key press via Windows API.
 * @param {number} vk
 */
async function sendKey(vk) {
  if (!isWindows()) {
    logger.warn(`Media keys are only implemented on Windows; key 0x${vk.toString(16)} ignored.`)
    return false
  }

  const script = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class W {
        [DllImport("user32.dll", SetLastError=true)]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    }
"@
    [W]::keybd_event(${vk}, 0, 0, 0)
    Start-Sleep -Milliseconds 80
    [W]::keybd_event(${vk}, 0, 2, 0)
  `
  
  return await runPowerShellScript(script)
}

/**
 * Next track. Returns { success, key:'next', error? }.
 */
async function mediaNext() {
  const ok = await sendKey(VK.mediaNextTrack)
  return ok
    ? { success: true, key: 'next' }
    : { success: false, key: 'next', error: 'Failed to send media-Next key.' }
}

/**
 * Previous track.
 */
async function mediaPrevious() {
  const ok = await sendKey(VK.mediaPrevTrack)
  return ok
    ? { success: true, key: 'previous' }
    : { success: false, key: 'previous', error: 'Failed to send media-Previous key.' }
}

/**
 * Play / Pause toggle.
 */
async function mediaPlayPause() {
  const ok = await sendKey(VK.mediaPlayPause)
  return ok
    ? { success: true, key: 'playpause' }
    : { success: false, key: 'playpause', error: 'Failed to send media-PlayPause key.' }
}

/**
 * Stop.
 */
async function mediaStop() {
  const ok = await sendKey(VK.mediaStop)
  return ok
    ? { success: true, key: 'stop' }
    : { success: false, key: 'stop', error: 'Failed to send media-Stop key.' }
}

module.exports = { mediaNext, mediaPrevious, mediaPlayPause, mediaStop, VK }
