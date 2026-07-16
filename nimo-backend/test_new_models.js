require('dotenv').config()
const { GoogleGenAI } = require('@google/genai')

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in your environment or .env file.')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })

const models = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
]

;(async () => {
  for (const model of models) {
    console.log(`Testing model: ${model}...`)
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Hello',
        config: { maxOutputTokens: 10 }
      })
      console.log(`  SUCCESS for ${model}! Response:`, response.text?.trim())
    } catch (err) {
      console.error(`  FAILED for ${model}:`, err.message || err)
    }
  }
})()
