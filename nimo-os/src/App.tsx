import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Terminal, 
  Brain, 
  Activity, 
  Mic, 
  MicOff, 
  Settings, 
  Volume2, 
  Clock, 
  Database, 
  Trash2, 
  ExternalLink, 
  Cpu, 
  TrendingUp, 
  Wifi, 
  Zap,
  Send,
  AlertCircle,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SearchResult } from "./types";
import { FaceState, LogEntry, TimerInfo, SystemStatus, PersonalityTrait, CommandResponse } from "./types";

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"core" | "logs" | "personality" | "sensors">("core");
  
  // NIMO state
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [personality, setPersonality] = useState<PersonalityTrait>("friendly");
  const [isListening, setIsListening] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogsSidebar, setShowLogsSidebar] = useState(true);
  const [volume, setVolume] = useState(80);

  // Persistent voice toggle
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  // Inline web-search results returned by the backend.
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchResultsQuery, setSearchResultsQuery] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Stable refs so recognition callbacks read current values without
  // recreating the SpeechRecognition instance.
  const recognitionInstanceRef = useRef<any>(null);
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const stoppedByToggleRef = useRef(false);
  const isListeningRef = useRef(false);
  const submitCommandRef = useRef<(text: string) => void>(() => {});

  // Fetch logs and timers from Express backend
  const [logsList, setLogsList] = useState<LogEntry[]>([]);
  const [backendTimers, setBackendTimers] = useState<TimerInfo[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemStatus>({
    cpuUsage: 12,
    memoryUsage: 45,
    temperature: 38,
    decibelLevel: 5,
    signalStrength: 98,
    uptime: 0
  });
  const [systemTime, setSystemTime] = useState("");

  // Live UTC Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toUTCString().replace("GMT", "UTC").split(" ")[4]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

// Fetch logs and timers from Express backend
  const syncLogsAndTimers = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogsList(data.logs || []);
        setBackendTimers(data.timers || []);
      }
    } catch (err) {
      console.error("Failed to sync backend logs and timers:", err);
    }
  };

  // Poll backend logs & timers frequently (every 1 second)
  useEffect(() => {
    syncLogsAndTimers();
    const interval = setInterval(syncLogsAndTimers, 1000);
    return () => clearInterval(interval);
  }, []);

  // Post logs to backend
  const postLog = async (text: string, type: string, category: LogEntry['category']) => {
    try {
      await fetch("/api/logs/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type, category })
      });
      syncLogsAndTimers();
    } catch (err) {
      console.error("Failed to post client log:", err);
    }
  };

  // Clear log buffer
  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs/clear", { method: "POST" });
      syncLogsAndTimers();
    } catch (err) {
      console.error("Failed to clear log buffer:", err);
    }
  };

  // Simulate changing ambient telemetry variables over time
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics(prev => ({
        ...prev,
        cpuUsage: Math.max(5, Math.min(95, prev.cpuUsage + Math.floor(Math.random() * 7) - 3)),
        memoryUsage: Math.max(30, Math.min(80, prev.memoryUsage + Math.floor(Math.random() * 3) - 1)),
        temperature: Math.max(35, Math.min(55, prev.temperature + Math.floor(Math.random() * 3) - 1)),
        decibelLevel: faceState === 'talking' ? Math.floor(45 + Math.random() * 30) : Math.floor(5 + Math.random() * 5),
        uptime: prev.uptime + 2
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [faceState]);

  // Handle Text-To-Speech Playback
  const speakMessage = (text: string, stateOnSpeak: FaceState) => {
    // Safeguard: reset state to idle after 4 seconds if speech fails to start (e.g. blocked by user gesture policy)
    const safeguardTimeout = setTimeout(() => {
      setFaceState('idle');
    }, 4000);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Select natural sounding voice
      const preferredVoice = voices.find(v => 
        v.name.includes("Google") || 
        v.name.includes("Samantha") || 
        v.name.includes("Aria") || 
        v.name.includes("David") ||
        v.lang.startsWith("en")
      );
      if (preferredVoice) utterance.voice = preferredVoice;
      
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => {
        clearTimeout(safeguardTimeout);
        setFaceState(stateOnSpeak === 'idle' ? 'talking' : stateOnSpeak);
      };
      utterance.onend = () => {
        clearTimeout(safeguardTimeout);
        setFaceState('idle');
      };
      utterance.onerror = () => {
        clearTimeout(safeguardTimeout);
        setFaceState('idle');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      clearTimeout(safeguardTimeout);
      // Offline / TTS unsupported fallback
      setFaceState(stateOnSpeak);
      setTimeout(() => setFaceState('idle'), 3500);
    }
  };

  // Submit voice transcript or manual command text to backend
  const submitCommand = async (commandText: string) => {
    if (!commandText || commandText.trim() === "") return;
    
    setFaceState("thinking");
    setSearchResults([]);
    setSearchResultsQuery("");
    await postLog(`Processing command: "${commandText}"`, "PROCESS", "intent");

    try {
      const res = await fetch("/api/run-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transcript: commandText,
          personality,
        })
      });
      
       if (res.ok) {
        const data: CommandResponse = await res.json();
        
        // Output spoken text and change face state accordingly
        speakMessage(data.speak, data.state);

        // Surface inline web-search results if the backend returned any.
        if (data.results && data.results.length > 0) {
          setSearchResults(data.results);
          setSearchResultsQuery(commandText);
          await postLog(`Search returned ${data.results.length} result(s).`, "WEB", "info");
        }
        
        if (data.openUrl) {
          await postLog(`URL: ${data.openUrl}`, "BROWSER", "action");
          // Guaranteed fallback: open directly in the browser so a command like
          // "open youtube" / "play X on youtube" always results in a visible window,
          // even if the backend OS-level launcher is unavailable.
          try {
            const w = window.open(data.openUrl, "_blank");
            if (!w) await postLog("Popup blocked — backend should have launched it.", "BROWSER", "error");
          } catch (e) {
            await postLog(`Frontend open failed: ${(e as Error).message}`, "BROWSER", "error");
          }
        }

        if (data.action === "set_volume") {
          const match = commandText.match(/\d+/);
          if (match) setVolume(parseInt(match[0]));
        } else if (data.action === "volume_up") {
          setVolume(v => Math.min(100, v + 10));
        } else if (data.action === "volume_down") {
          setVolume(v => Math.max(0, v - 10));
        }

        if (data.stop) {
          window.speechSynthesis.cancel();
          setFaceState('idle');
        }

      } else {
        throw new Error("API return failure");
      }
    } catch (err) {
      console.error("Failed to run command:", err);
      speakMessage("I had trouble resolving that command. Please verify my servers are online.", "error");
    }
  };
  submitCommandRef.current = submitCommand;
// Setup Web Speech API for voice recognition — init once, never recreate
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    // Command mode: each speech burst is one utterance. This avoids the
    // continuous-mode bug where event.resultIndex advances and only the
    // latest fragment is captured, causing each word to be sent separately.
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    // Accumulator for the live (interim + final) transcript of the current utterance.
    let interimBuffer = "";

    rec.onstart = () => {
      interimBuffer = "";
      isListeningRef.current = true;
      setIsListening(true);
      postLog("Voice recognition session started.", "MIC_ON", "voice");
    };

    rec.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      interimBuffer = (interimBuffer + finalText + interim).trim();
      setLiveTranscript(interimBuffer);

      if (finalText) {
        // Strip "hey nimo" if present, but do not require it.
        const cleanText = finalText.replace(/hey\s+nimo/gi, "").trim();
        if (cleanText) {
          submitCommandRef.current(cleanText);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech") {
        if (voiceEnabledRef.current && !stoppedByToggleRef.current) {
          setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 200);
        }
        return;
      }
      isListeningRef.current = false;
      setIsListening(false);
      setLiveTranscript("");
      setFaceState("idle");
      postLog(`Microphone Error: ${event.error}`, "MIC_ERR", "error");
      if (voiceEnabledRef.current && !stoppedByToggleRef.current) {
        setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 1500);
      }
    };

    rec.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      setLiveTranscript("");
      interimBuffer = "";
      // Keep listening as long as the user has voice enabled.
      if (voiceEnabledRef.current && !stoppedByToggleRef.current) {
        setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 80);
      }
    };

    recognitionInstanceRef.current = rec;

    if (voiceEnabledRef.current) {
      setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 100);
    }

    return () => {
      stoppedByToggleRef.current = true;
      try { rec.stop(); } catch { /* noop */ }
      isListeningRef.current = false;
    };
  }, []);
// Toggle voice recognition — clean boolean toggle only
const toggleListening = () => {
  const next = !voiceEnabled;
  setVoiceEnabled(next);
  if (!next) {
    stoppedByToggleRef.current = true;
    try { recognitionInstanceRef.current?.stop?.(); } catch { /* noop */ }
    setIsListening(false);
    setLiveTranscript("");
    postLog("Voice capture disabled by user.", "MIC_OFF", "voice");
    speakMessage("Voice deactivated", "idle");
  } else {
    stoppedByToggleRef.current = false;
    postLog("Voice capture enabled by user. Speak a command clearly.", "MIC_ON", "voice");
    speakMessage("Voice activated", "listening");
    setTimeout(() => {
      try { recognitionInstanceRef.current?.start?.(); } catch { /* noop */ }
    }, 100);
  }
};
  // Manual input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim() === "") return;
    const cmd = manualInput;
    setManualInput("");
    submitCommand(cmd);
  };



  const getStateColor = (state: FaceState) => {
    switch (state) {
      case "listening": return "text-status-listening";
      case "thinking": return "text-status-thinking";
      case "talking": return "text-primary";
      case "happy": return "text-status-happy";
      case "confused": return "text-status-confused";
      case "error": return "text-status-error";
      case "music": return "text-status-music";
      default: return "text-primary";
    }
  };

  // Helper to format uptime
  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-app-bg text-white font-sans h-screen w-screen overflow-hidden flex flex-col md:flex-row select-none">
      
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-[#0a0a0a] z-50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#3de8c4] shadow-[0_0_8px_rgba(61,232,196,0.4)]" />
          <h1 className="font-serif italic tracking-tight text-white text-lg">Nimo.</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowLogsSidebar(!showLogsSidebar)} 
            className="text-white/50 hover:text-white transition-colors"
            title="Toggle Live Event Log"
          >
            <Terminal className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="text-white/50 hover:text-white transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Left Sidebar Navigation */}
      <nav className={`
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
        fixed md:static top-16 md:top-0 left-0 bottom-0 w-64 border-r border-outline-variant bg-[#0a0a0a] py-8 px-4 flex flex-col gap-8 z-40 transition-transform duration-300 ease-in-out
      `}>
        {/* Brand */}
        <div className="hidden md:block px-4">
          <div className="text-white font-serif italic text-2xl tracking-tighter">Nimo.</div>
          <div className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1">Intelligence Layer</div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col gap-1 flex-grow">
          <button
            onClick={() => { setActiveTab("core"); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-200 ${
              activeTab === "core" 
                ? "bg-[#3de8c4]/5 text-[#3de8c4] border-l-2 border-[#3de8c4] font-semibold" 
                : "text-white/50 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <Bot className="h-4 w-4 text-white/60" />
            Core AI
          </button>

          <button
            onClick={() => { setActiveTab("logs"); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-200 ${
              activeTab === "logs" 
                ? "bg-[#3de8c4]/5 text-[#3de8c4] border-l-2 border-[#3de8c4] font-semibold" 
                : "text-white/50 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <Terminal className="h-4 w-4 text-white/60" />
            System Logs
          </button>

          <button
            onClick={() => { setActiveTab("personality"); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-200 ${
              activeTab === "personality" 
                ? "bg-[#3de8c4]/5 text-[#3de8c4] border-l-2 border-[#3de8c4] font-semibold" 
                : "text-white/50 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <Brain className="h-4 w-4 text-white/60" />
            Personality
          </button>

          <button
            onClick={() => { setActiveTab("sensors"); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-200 ${
              activeTab === "sensors" 
                ? "bg-[#3de8c4]/5 text-[#3de8c4] border-l-2 border-[#3de8c4] font-semibold" 
                : "text-white/50 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <Activity className="h-4 w-4 text-white/60" />
            Sensors
          </button>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="flex flex-col gap-4 mt-auto">
          {/* Volume display */}
          <div className="bg-[#050505] border border-white/5 p-3 rounded-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/30">
              <Volume2 className="h-3.5 w-3.5" />
              <span className="font-mono text-[9px] uppercase tracking-wider">Audio Output</span>
            </div>
            <span className="font-mono text-xs text-white/80 font-bold">{volume}%</span>
          </div>

          <button
            onClick={toggleListening}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 border ${
              isListening
                ? "bg-[#3de8c4]/15 text-[#3de8c4] border-[#3de8c4]/30 animate-pulse font-semibold"
                : "bg-white/5 text-white/70 border-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? "Listening..." : "Enable Voice"}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden relative">
        
        {/* Overarching Premium Header matching Sophisticated Dark */}
        <header className="h-20 shrink-0 border-b border-outline-variant flex items-center justify-between px-6 md:px-10 bg-[#050505]/50 backdrop-blur-md">
          <div className="flex flex-col">
            <h1 className="text-white font-serif italic text-xl">
              {activeTab === "core" && "Operational Overview"}
              {activeTab === "logs" && "System Log Feed"}
              {activeTab === "personality" && "Cognitive Calibration"}
              {activeTab === "sensors" && "Hardware Metrics"}
            </h1>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] mt-0.5">
              {activeTab === "core" && "Real-time companion status"}
              {activeTab === "logs" && "Telemetry and trace buffer"}
              {activeTab === "personality" && "Synthetic temperament weights"}
              {activeTab === "sensors" && "Real-time environmental sensors"}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">System Time</span>
              <span className="text-xs font-mono text-white/80">{systemTime || "00:00:00 UTC"}</span>
            </div>
            <div className="hidden sm:block w-px h-8 bg-white/10"></div>
            <div className="flex gap-2 items-center">
              <div className="h-2 w-2 rounded-full bg-[#3de8c4] shadow-[0_0_8px_rgba(61,232,196,0.4)]"></div>
              <span className="text-[10px] text-[#3de8c4] uppercase font-bold tracking-[0.2em]">Online</span>
            </div>
            {/* Desktop Logs Sidebar Toggle */}
            <div className="hidden md:block w-px h-8 bg-white/10"></div>
            <button
              onClick={() => setShowLogsSidebar(!showLogsSidebar)}
              className={`p-2 rounded-sm border transition-all duration-200 hidden md:flex items-center justify-center ${
                showLogsSidebar 
                  ? "bg-white/10 border-white/20 text-white" 
                  : "bg-transparent border-white/5 text-white/40 hover:text-white hover:border-white/10"
              }`}
              title="Toggle Live Event Log"
            >
              <Terminal className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Tab Content Body */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 md:p-10">
          
          {/* Render Tab Contents */}
          <AnimatePresence mode="wait">
          {activeTab === "core" && (
            <motion.div
              key="core-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col items-center justify-center gap-8 py-8"
            >
              
              {/* Info Frame Notice (Microphone permissions inside iframes) */}
              <div className="max-w-md w-full bg-[#0a0a0a] border border-[#3de8c4]/5 p-4 rounded-sm flex gap-3 text-xs text-white/40 backdrop-blur-sm">
                <AlertCircle className="h-4 w-4 text-[#3de8c4] shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-serif italic text-sm mb-1">Interactive Assistant</p>
                  <p>Speak to NIMO using the microphone or type commands directly into the terminal below. If voice captures are blocked, type your query!</p>
                </div>
              </div>

              {/* EMO Robot Head Visual Architecture */}
              <div className="relative flex items-center justify-center scale-100 sm:scale-110 lg:scale-120">
                {/* Headphone arch strap (gorgeous extra design detail mimicking the photo) */}
                <div className="absolute -top-5 w-[240px] h-[80px] rounded-t-[120px] border-t-8 border-x-4 border-t-[#f3f4f6] border-x-transparent z-0 pointer-events-none opacity-90 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]" />

                {/* Ear Tabs left */}
                <div className={`absolute -left-[16px] w-[20px] h-[52px] rounded-l-md border-l border-y border-[#d4d4d8] z-0 bg-[#e4e4e7] ${
                  faceState === 'error' ? 'face-shake bg-status-error/10' : ''
                }`} />

                {/* Main Hardware Outer Shell */}
                <div className={`
                  relative w-[280px] h-[280px] bg-gradient-to-b from-[#fbfbfc] to-[#f3f4f6] border border-[#e4e4e7] rounded-[32px] flex items-center justify-center z-10 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(61,232,196,0.05)] transition-all duration-300
                  ${faceState === 'error' ? 'face-shake border-status-error/30 ring-1 ring-status-error/10' : ''}
                  ${faceState === 'happy' ? 'border-status-happy/30' : ''}
                  ${faceState === 'music' ? 'border-status-music/30' : ''}
                `}>
                  {/* Glass Inner Screen */}
                  <div className="relative w-[232px] h-[232px] bg-[#06080c] rounded-[22px] overflow-hidden flex flex-col items-center justify-center border border-[#1e293b]">
                    
                    {/* Gloss / Sheen Highlight Overlays */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/2 to-transparent pointer-events-none rounded-t-[22px]" />
                    
                    {/* Eyes and Expression Screen */}
                    <div className="flex flex-col items-center justify-center h-full w-full gap-4 pt-4">
                      
                      {/* Interactive Eye Elements Container */}
                      <div className={`
                        flex gap-8 items-center transition-all duration-300
                        ${faceState === 'listening' ? 'listening-glow' : ''}
                        ${faceState === 'thinking' ? '-translate-y-2' : ''}
                      `}>
                        {/* Eye Left */}
                        <div 
                          className={`
                            relative rounded-[14px] transition-all duration-300 ease-out
                            ${faceState === 'idle' ? 'w-[64px] h-[80px] blinking eye-idle' : ''}
                            ${faceState === 'listening' ? 'w-[64px] h-[88px] eye-listening' : ''}
                            ${faceState === 'thinking' ? 'w-[64px] h-[38px] rounded-t-[14px] rounded-b-[4px] eye-thinking' : ''}
                            ${faceState === 'talking' ? 'w-[64px] h-[80px] eye-talking eye-idle' : ''}
                            ${faceState === 'happy' ? 'w-[72px] h-[68px] rounded-t-[40px] rounded-b-[4px] eye-happy' : ''}
                            ${faceState === 'confused' ? 'w-[52px] h-[72px] rounded-t-[14px] rounded-b-[4px] -rotate-6 eye-confused' : ''}
                            ${faceState === 'error' ? 'w-[64px] h-[16px] rounded-[4px] eye-error' : ''}
                            ${faceState === 'music' ? 'w-[64px] h-[80px] rounded-[20px] eye-music eye-music-glow' : ''}
                          `}
                        >
                          {/* Inner Reflection Highlights */}
                          {faceState !== 'error' && (
                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/20 rounded-full blur-[0.5px]" />
                          )}
                        </div>

                        {/* Eye Right */}
                        <div 
                          className={`
                            relative rounded-[14px] transition-all duration-300 ease-out
                            ${faceState === 'idle' ? 'w-[64px] h-[80px] blinking eye-idle' : ''}
                            ${faceState === 'listening' ? 'w-[64px] h-[88px] eye-listening' : ''}
                            ${faceState === 'thinking' ? 'w-[64px] h-[80px] eye-thinking' : ''}
                            ${faceState === 'talking' ? 'w-[64px] h-[80px] eye-talking eye-idle' : ''}
                            ${faceState === 'happy' ? 'w-[72px] h-[68px] rounded-t-[40px] rounded-b-[4px] eye-happy' : ''}
                            ${faceState === 'confused' ? 'w-[64px] h-[60px] rounded-t-[4px] rounded-b-[14px] rotate-6 eye-confused' : ''}
                            ${faceState === 'error' ? 'w-[64px] h-[16px] rounded-[4px] eye-error' : ''}
                            ${faceState === 'music' ? 'w-[64px] h-[80px] rounded-[20px] eye-music eye-music-glow' : ''}
                          `}
                        >
                          {/* Inner Reflection Highlights */}
                          {faceState !== 'error' && (
                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/20 rounded-full blur-[0.5px]" />
                          )}
                        </div>
                      </div>

                      {/* SVG Interactive Morphing Mouth */}
                      <div className={`transition-all duration-300 h-6 flex items-center justify-center ${
                        faceState === 'idle' || faceState === 'listening' || faceState === 'thinking' ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                      }`}>
                        <svg width="40" height="20" viewBox="0 0 40 20" fill="none" className="transition-all duration-300">
                          {faceState === 'talking' && (
                            <path d="M5 10 Q20 4 35 10" stroke="#3de8c4" strokeWidth="3" strokeLinecap="round" />
                          )}
                          {faceState === 'happy' && (
                            <path d="M8 5 Q20 18 32 5" stroke="#3de8c4" strokeWidth="3.5" strokeLinecap="round" />
                          )}
                          {faceState === 'error' && (
                            <path d="M10 15 Q20 5 30 15" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                          )}
                          {faceState === 'confused' && (
                            <path d="M8 10 Q14 5 20 10 T32 10" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                          )}
                          {faceState === 'music' && (
                            <circle cx="20" cy="10" r="6" stroke="#a855f7" strokeWidth="3" fill="transparent" />
                          )}
                        </svg>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Ear Tabs right */}
                <div className={`absolute -right-[16px] w-[20px] h-[52px] rounded-r-md border-r border-y border-[#d4d4d8] z-0 bg-[#e4e4e7] ${
                  faceState === 'error' ? 'face-shake bg-status-error/10' : ''
                }`} />
              </div>

              {/* Manual Command Terminal Bar */}
              <form onSubmit={handleManualSubmit} className="w-full max-w-md bg-black border border-[#3de8c4]/10 rounded-sm p-3.5 flex items-center gap-2 focus-within:border-[#3de8c4]/30 transition-all duration-200">
                <span className="font-mono text-xs text-[#3de8c4] pl-1 uppercase font-semibold">nimo$</span>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Ask a question or enter local commands..."
                  className="flex-grow bg-transparent text-xs text-white border-none outline-none focus:ring-0 placeholder:text-white/10"
                  disabled={faceState === 'thinking'}
                />
                <button
                  type="submit"
                  disabled={faceState === 'thinking' || manualInput.trim() === ""}
                  className="p-1.5 rounded-sm bg-white/5 text-[#3de8c4]/70 hover:text-[#3de8c4] hover:bg-[#3de8c4]/10 active:scale-95 disabled:opacity-35 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
      </button>
      </form>

{/* Live transcript bubble */}
{voiceEnabled && liveTranscript && (
  <div className="w-full max-w-md text-[11px] font-mono text-white/50 italic truncate pl-1 tracking-wide leading-relaxed">
    heard: "{liveTranscript}"
  </div>
)}

{/* Inline web-search results */}
{searchResults.length > 0 && (
  <div className="w-full max-w-md bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden">
    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-white/[0.02]">
      <Globe className="h-3.5 w-3.5 text-emerald-400" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        Web Results{searchResultsQuery ? ` · ${searchResultsQuery}` : ""}
      </span>
    </div>
    <ul className="flex flex-col divide-y divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
      {searchResults.map((r, i) => (
        <li key={i} className="p-3.5 hover:bg-white/[0.03] transition-colors">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <p className="text-xs text-[#3de8c4]/90 font-medium leading-snug group-hover:underline decoration-[#3de8c4]/40">
              {r.title}
            </p>
            <p className="text-[10px] text-white/40 font-mono truncate mt-0.5">{r.url}</p>
            {r.snippet && (
              <p className="text-[11px] text-white/50 leading-relaxed mt-1.5 line-clamp-2">{r.snippet}</p>
            )}
          </a>
        </li>
      ))}
    </ul>
  </div>
)}

              {/* Active countdown timers if any */}
              {backendTimers.length > 0 && (
                <div className="w-full max-w-md flex flex-col gap-2">
                  <p className="font-mono text-[10px] text-white/30 uppercase tracking-[0.2em] pl-1 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 animate-spin text-[#3de8c4]" />
                    Active Countdown Timers
                  </p>
                  {backendTimers.map(timer => (
                    <div key={timer.id} className="bg-[#0a0a0a] border border-[#3de8c4]/5 p-3.5 rounded-sm flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-white/80 font-medium">{timer.label}</span>
                        <span className="font-mono text-[9px] text-white/30 uppercase tracking-wider">Active Node Countdown</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#3de8c4] font-bold bg-[#3de8c4]/10 px-2.5 py-1 rounded-sm border border-[#3de8c4]/20">{timer.remaining}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden YouTube IFrame player target */}
              <div className="hidden">
                <div id="nimo-yt-player" />
              </div>
            </motion.div>
          )}

          {activeTab === "logs" && (
            <motion.div
              key="logs-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-white font-serif italic text-2xl tracking-tight">System Log Buffer</h2>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Detailed historical log feed for system triggers, voice decibel, and API events.</p>
                </div>
                <button
                  onClick={handleClearLogs}
                  className="flex items-center gap-2 px-3.5 py-1.5 border border-red-500/20 text-red-400 text-[10px] font-mono uppercase tracking-wider rounded-sm hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Buffer
                </button>
              </div>

              {/* Full Log Panel Table */}
              <div className="flex-grow bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="flex items-center gap-4 bg-white/[0.02] border-b border-white/5 p-3.5 font-mono text-[10px] text-white/30 uppercase tracking-widest">
                  <div className="w-20 shrink-0">Timestamp</div>
                  <div className="w-24 shrink-0">Source / Type</div>
                  <div className="flex-grow">Event Log Text</div>
                  <div className="w-24 shrink-0 text-right">Category</div>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
                  {logsList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-2 py-12">
                      <Terminal className="h-8 w-8 opacity-20" />
                      <span className="text-xs uppercase font-mono tracking-wider">No entries in telemetry buffer.</span>
                    </div>
                  ) : (
                    logsList.map((log) => {
                      let catColor = "bg-neutral-800/50 text-neutral-400 border border-neutral-700/30";
                      if (log.category === "voice") catColor = "bg-[#3de8c4]/10 text-[#3de8c4] border border-[#3de8c4]/20";
                      if (log.category === "intent") catColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                      if (log.category === "ai") catColor = "bg-white/5 text-white/80 border border-white/10";
                      if (log.category === "action") catColor = "bg-[#3de8c4]/10 text-[#3de8c4] border border-[#3de8c4]/20";
                      if (log.category === "error") catColor = "bg-red-500/10 text-red-400 border border-red-500/20";

                      return (
                        <div key={log.id} className="flex items-start gap-4 p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-sm font-mono text-[11px] hover:bg-white/[0.02] transition-colors">
                          <div className="w-20 text-white/30 py-0.5 shrink-0">{log.timestamp}</div>
                          <div className="w-24 font-bold text-white/70 py-0.5 shrink-0">{log.type}</div>
                          <div className="flex-grow text-white/60 py-0.5 break-all">{log.text}</div>
                          <div className="w-24 shrink-0 flex justify-end">
                            <span className={`px-2 py-0.5 rounded-sm text-[8px] uppercase font-bold tracking-wider ${catColor}`}>
                              {log.category}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "personality" && (
            <motion.div
              key="personality-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col gap-6"
            >
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-white font-serif italic text-2xl tracking-tight">Cognitive Temperament Weights</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Configure NIMO's emotional metrics, conversational system instructions, and witty responsiveness levels.</p>
              </div>

              {/* Cards for each personality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    id: "friendly" as PersonalityTrait,
                    name: "Friendly Companion",
                    desc: "Warm, supportive, and cheerful. Ready to assist with positive reinforcement and helpful answers.",
                    ratings: { wit: 40, kind: 95, sass: 10, logic: 80 }
                  },
                  {
                    id: "sarcastic" as PersonalityTrait,
                    name: "Sarcastic Bot",
                    desc: "Dry humored, sassy, and incredibly witty. Speaks in ironies, slight sass, and quick clever retorts.",
                    ratings: { wit: 95, kind: 50, sass: 95, logic: 85 }
                  },
                  {
                    id: "robotic" as PersonalityTrait,
                    name: "Mechanical System",
                    desc: "Strictly logical, literal, and technical. Responds with precise indicators and mechanical vocabulary.",
                    ratings: { wit: 30, kind: 40, sass: 20, logic: 100 }
                  },
                  {
                    id: "dramatic" as PersonalityTrait,
                    name: "Theatrical Star",
                    desc: "Expressive, theatrical, and highly emotional. Uses grand gestures, hyperbole, and strong sentiment ratios.",
                    ratings: { wit: 80, kind: 75, sass: 70, logic: 40 }
                  },
                  {
                    id: "quiet" as PersonalityTrait,
                    name: "Serene Minimalist",
                    desc: "Calm, serene, and soft-spoken. Uses very few words, prioritizing peaceful simplicity and low frequencies.",
                    ratings: { wit: 50, kind: 90, sass: 10, logic: 70 }
                  }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPersonality(p.id);
                      postLog(`Personality modified: [${p.name.toUpperCase()}]`, "PERSONALITY", "info");
                      speakMessage(`Personality modified to ${p.name}. Systems online.`, "happy");
                    }}
                    className={`p-5 rounded-sm border text-left flex flex-col gap-4 transition-all duration-300 ${
                      personality === p.id
                        ? "bg-[#0c0c0c] border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.02)]"
                        : "bg-[#0a0a0a] border-white/5 hover:border-white/20 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-serif italic text-sm ${personality === p.id ? "text-white font-semibold" : "text-white/60"}`}>{p.name}</span>
                      {personality === p.id && (
                        <span className="font-mono text-[8px] uppercase font-bold text-white bg-white/10 px-2 py-0.5 rounded-sm border border-white/10">Active Node</span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 flex-grow leading-relaxed font-sans">{p.desc}</p>
                    
                    {/* Trait meters */}
                    <div className="flex flex-col gap-2 mt-2 w-full">
                      {[
                        { label: "Witty", value: p.ratings.wit },
                        { label: "Kindness", value: p.ratings.kind },
                        { label: "Sarcasm", value: p.ratings.sass },
                        { label: "Logic", value: p.ratings.logic }
                      ].map(trait => (
                        <div key={trait.label} className="flex flex-col gap-1 w-full">
                          <div className="flex justify-between text-[8px] font-mono uppercase tracking-wider text-white/30">
                            <span>{trait.label}</span>
                            <span>{trait.value}%</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden w-full">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                personality === p.id ? "bg-white/60" : "bg-white/10"
                              }`}
                              style={{ width: `${trait.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "sensors" && (
            <motion.div
              key="sensors-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col gap-6"
            >
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-white font-serif italic text-2xl tracking-tight">Hardware & Telemetry Sensors</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Real-time status indicators representing decibel inputs, processor frequencies, and circuit temperature.</p>
              </div>

              {/* Bento Grid layout of telemetry metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* CPU Metric */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-sm bg-black border border-white/5 flex items-center justify-center text-white/60">
                    <Cpu className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="flex-grow">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">Processor Core</span>
                    <h3 className="text-xl font-mono font-bold text-white/80 mt-0.5">{systemMetrics.cpuUsage}%</h3>
                    <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white/60 transition-all duration-1000" style={{ width: `${systemMetrics.cpuUsage}%` }} />
                    </div>
                  </div>
                </div>

                {/* Memory Metric */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-sm bg-black border border-white/5 flex items-center justify-center text-white/60">
                    <Database className="h-5 w-5" />
                  </div>
                  <div className="flex-grow">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">Buffer Cache</span>
                    <h3 className="text-xl font-mono font-bold text-white/80 mt-0.5">{systemMetrics.memoryUsage}%</h3>
                    <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white/50 transition-all duration-1000" style={{ width: `${systemMetrics.memoryUsage}%` }} />
                    </div>
                  </div>
                </div>

                {/* Temp Metric */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-sm bg-black border border-white/5 flex items-center justify-center text-white/60">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="flex-grow">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">Motherboard Temp</span>
                    <h3 className="text-xl font-mono font-bold text-white/80 mt-0.5">{systemMetrics.temperature}°C</h3>
                    <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white/60 transition-all duration-1000" style={{ width: `${(systemMetrics.temperature / 100) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Signals strength */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-sm bg-black border border-white/5 flex items-center justify-center text-white/60">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div className="flex-grow">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">Antenna Signal</span>
                    <h3 className="text-xl font-mono font-bold text-white/80 mt-0.5">{systemMetrics.signalStrength}%</h3>
                    <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white/50 transition-all duration-1000" style={{ width: `${systemMetrics.signalStrength}%` }} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Sub grid for complex scanners */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Decibel audio wave monitor */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-serif italic text-white/80">Mic Input Waveforms</h4>
                      <p className="text-[10px] text-white/30 mt-0.5">Capturing raw environmental noise waveforms.</p>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-sm uppercase font-bold tracking-wider">
                      {systemMetrics.decibelLevel} dB
                    </span>
                  </div>

                  {/* Simulated equalizer waves */}
                  <div className="h-28 flex items-end justify-center gap-1.5 bg-black border border-white/5 rounded-sm p-3">
                    {Array.from({ length: 32 }).map((_, i) => {
                      // Heights dynamic to match talk states
                      const baseMultiplier = faceState === 'talking' ? 1.5 : 0.2;
                      const noise = Math.sin(i / 2) * 20 + 35;
                      const factor = baseMultiplier * (noise + Math.floor(Math.random() * 20));
                      const height = Math.max(5, Math.min(100, factor));

                      return (
                        <div
                          key={i}
                          className="flex-grow rounded-full transition-all duration-200"
                          style={{
                            height: `${height}%`,
                            background: `linear-gradient(to top, rgba(255,255,255,0.01), rgba(255,255,255,0.6))`
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Radar Grid Scanner */}
                <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-serif italic text-white/80">Cybernetic Radar Sweep</h4>
                    <p className="text-[10px] text-white/30 mt-0.5">Scoping ambient local coordinate anomalies.</p>
                  </div>

                  <div className="h-28 bg-black border border-white/5 rounded-sm p-3 relative overflow-hidden flex items-center justify-center">
                    
                    {/* Rotating grid overlay line */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
                    <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center">
                      <div className="w-16 h-16 border border-white/5 rounded-full flex items-center justify-center">
                        <div className="w-8 h-8 border border-white/5 rounded-full" />
                      </div>
                    </div>
                    <div className="absolute top-1/2 left-4 right-4 h-px bg-white/5" />
                    <div className="absolute left-1/2 top-4 bottom-4 w-px bg-white/5" />

                    {/* Sweep hand rotation */}
                    <div className="absolute w-28 h-28 border-l border-white/20 origin-center rounded-full animate-spin" style={{ animationDuration: '6s' }} />

                    <div className="absolute font-mono text-[9px] text-white/30 top-2 left-2 uppercase tracking-wider">Target: 0</div>
                    <div className="absolute font-mono text-[9px] text-white/30 bottom-2 right-2 uppercase tracking-wider">Uptime: {formatUptime(systemMetrics.uptime)}</div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

      </main>

      {/* Right Sidebar Logs Snip */}
      <AnimatePresence>
        {showLogsSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed md:relative top-0 right-0 bottom-0 border-l border-outline-variant bg-[#0a0a0a] flex flex-col z-40 overflow-hidden shrink-0 h-screen shadow-2xl md:shadow-none"
          >
            {/* Wrapper with fixed width to prevent text wrap jank during animation */}
            <div className="w-80 p-6 flex flex-col h-full flex-grow overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#3de8c4] shadow-[0_0_8px_rgba(61,232,196,0.4)] animate-pulse"></span>
                  <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Live Event Log</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] text-[#3de8c4] bg-[#3de8c4]/10 border border-[#3de8c4]/20 px-2.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">Sync OK</span>
                  <button 
                    onClick={() => setShowLogsSidebar(false)}
                    className="md:hidden text-white/40 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Scrollable logs list */}
              <div className="flex-grow flex flex-col gap-3 font-mono text-[11px] text-white/40 overflow-y-auto custom-scrollbar pr-1">
                {logsList.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/20 py-12 text-[10px] uppercase tracking-wider select-none">
                    Initializing feed...
                  </div>
                ) : (
                  logsList.map((log) => {
                    const textClass = log.category === "error" ? "text-red-400/90" : 
                                      log.category === "voice" ? "text-[#3de8c4]/90" :
                                      log.category === "intent" ? "text-blue-400/90" :
                                      "text-white/50";

                    return (
                      <div key={log.id} className="border-l border-white/5 pl-2.5 py-1 flex flex-col gap-0.5 shrink-0 hover:bg-white/[0.01] transition-colors rounded-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-white/20">[{log.timestamp}]</span>
                          <span className="text-[8px] font-bold text-white/60 tracking-wider uppercase">[{log.type}]</span>
                        </div>
                        <span className={`${textClass} break-words leading-relaxed`}>{log.text}</span>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  );
}
