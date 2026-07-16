# NIMO OS - Project Product Requirements Document (PRD)

## 1. Project Overview
**NIMO OS** is a high-fidelity desktop voice assistant interface inspired by the minimalist, expressive design of desktop social robots like EMO. The core value proposition is an "emotional hardware" aesthetic where complex human-computer interaction is abstracted into simple, geometric facial expressions and real-time voice reactivity.

## 2. Target Audience
- Tech enthusiasts and collectors of desktop gadgets.
- Users seeking a more "personal" or "companion-like" AI interaction.
- Developers looking for a stylized, OS-level interface for LLM integrations.

## 3. Design Identity
- **Visual Style**: Cybernetic, dark-mode, high-contrast.
- **Color Palette**: 
  - Primary: Bright Cyan (#00E8D6)
  - Surface: Pure Black (#050507) / Near-Black (#0A0A0D)
  - State Colors: Blue-Cyan (Thinking), Cyan-Green (Happy), Amber (Music), Red (Error).
- **Core Component**: The "Face Screen" - a 280x280px rounded robot head containing expressive "Eye" modules that morph shapes to communicate emotion.

## 4. Key Features

### 4.1. Expressive Face Interface
- **Morphing Eyes**: Large rounded rectangles (64x80px) that change height, rotation, and border-radius to represent states (Idle, Listening, Thinking, Talking, Happy, Confused, Error, Music).
- **Physicality**: UI elements mimic physical hardware, including a "robot shell" with ears and a black glass inner screen.
- **Dynamic Mouth**: SVG-based mouth paths that appear only during specific emotional states or speech.

### 4.2. Voice Reactivity (Web Speech API)
- **Live Listening**: The interface triggers a "Listening" state automatically upon detecting user voice input.
- **Natural Transitions**: Automatic progression from Listening -> Thinking -> Talking based on speech detection.
- **Keyword Intelligence**: Facial expressions change dynamically when specific keywords (e.g., "happy", "error") are detected in the transcript.

### 4.3. System Infrastructure (NIMO OS)
- **Sidebar Navigation**: Permanent access to Core, Logs, Personality, and Sensors.
- **Event Log**: A monospace right-hand sidebar that tracks system initializations, voice engine status, and detected speech events in real-time.
- **Clean Aesthetic**: Removal of traditional UI "clutter" (graphs, labels) from the robot face to maintain immersion.

## 5. Technical Constraints
- **Platform**: Desktop Web / Electron-compatible.
- **Performance**: High-frequency CSS transitions (0.2s) for fluid eye morphing.
- **Accessibility**: High contrast ratios; clear visual state indicators beyond just color.

## 6. Success Metrics
- **Expressive Clarity**: Users can identify the AI's state (Thinking vs. Listening) within 200ms of state change.
- **Latency**: Voice-to-expression transition latency under 100ms.
- **User Engagement**: Qualitative feedback on the "personality" and "presence" of the interface.