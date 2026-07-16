const { exec } = require('child_process')
const url = 'https://www.youtube.com/embed?listType=search&list=dandelions&autoplay=1&rel=0&modestbranding=1'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const cmd = `start "" "${chrome}" --new-window "${url}"`
console.log('CMD:', cmd)
exec(cmd, { timeout: 8000 }, (err) => {
  console.log('EXEC ERR:', err ? err.message : 'none')
})
