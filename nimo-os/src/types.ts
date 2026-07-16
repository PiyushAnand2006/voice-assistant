/**
 * Shared Type Definitions for NIMO OS
 */

export type FaceState = 
  | 'idle' 
  | 'listening' 
  | 'thinking' 
  | 'talking' 
  | 'happy' 
  | 'confused' 
  | 'error' 
  | 'music';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: string;
  text: string;
  category: 'info' | 'voice' | 'intent' | 'ai' | 'action' | 'error';
}

export interface TimerInfo {
  id: string;
  duration: number; // in seconds
  remaining: number; // in seconds
  label: string;
  active: boolean;
}

export interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  decibelLevel: number;
  signalStrength: number;
  uptime: number; // in seconds
}

export type PersonalityTrait = 
  | 'friendly' 
  | 'sarcastic' 
  | 'robotic' 
  | 'dramatic' 
  | 'quiet';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CommandResponse {
  ok: boolean;
  action: string;
  result: string;
  speak: string;
  state: FaceState;
  openUrl?: string;
  results?: SearchResult[];
  timer?: {
    duration: number;
    label: string;
  };
  stop?: boolean;
  error?: string;
}
