require('dotenv').config()
const { GoogleGenAI } = require('@google/genai')

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in your environment or .env file.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })

;(async () => {
  try {
    const list = await ai.models.list()
    const page = list.pageInternal || []
    console.log(`Page has ${page.length} models:`)
    page.forEach((m, i) => {
      console.log(`${i + 1}: ${m.name} (${m.displayName})`)
    })
  } catch (err) {
    console.error('List models failed:', err.message || err)
  }
})()
