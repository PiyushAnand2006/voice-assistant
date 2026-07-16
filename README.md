# Voice Assistant (Basic API-based Search Assistant)

This project is a basic API-based voice/search assistant with:
- a desktop backend in Electron + Node.js
- a web UI app powered by React + Vite
- command routing for search, media, timers, and system actions
- API-driven AI responses using Gemini (and optional ElevenLabs TTS)

## Project Structure

- nimo-backend: Electron main process, IPC handlers, command parsing, system/media/search services
- nimo-os: React + Vite UI and local server entrypoint

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm 9+
- Windows/macOS/Linux

## Setup

1. Install backend dependencies:
   - cd nimo-backend
   - npm install

2. Install UI dependencies:
   - cd ../nimo-os
   - npm install

3. Configure environment files:
   - In nimo-backend, copy .env.example to .env and set GEMINI_API_KEY
   - Optionally set ELEVENLABS_API_KEY for TTS support
   - In nimo-os, copy .env.example to .env.local and set GEMINI_API_KEY if needed by UI-side flows

## Run In Development

1. Start from backend folder:
   - cd nimo-backend
   - npm run dev

This launches:
- UI dev server from nimo-os
- Electron app from nimo-backend

## Run Backend Only

- cd nimo-backend
- npm start

## Build

- cd nimo-backend
- npm run build

This builds the UI and packages Electron through electron-builder.

## Tests

- cd nimo-backend
- npm test

## Security Notes

- Do not commit .env files or API keys.
- This repository is configured to ignore environment and log files.
- API keys should be stored in local environment variables or OS keychain.

## Suggested Workflow

- Keep secrets in local .env files only.
- Commit source/config examples only (.env.example).
- Rotate API keys immediately if they were ever exposed.
