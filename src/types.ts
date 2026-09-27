export interface HotCue {
  time: number;
  color: string;
  label: string;
}

export interface PadData {
  id: string;
  name: string;
  fileName: string;
  duration: number;
  buffer: AudioBuffer | null;
  volume: number;
  loop: boolean;
  color: string;
  fadeTime: number;
  speed: number;
  hotcues: HotCue[];
  activeSources: ActiveSource[];
  isPlaying: boolean;
  currentTime: number;
  waveform: number[];
}

export interface ActiveSource {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  duration: number;
  offset: number;
}

export interface TabData {
  id: string;
  name: string;
  pads: PadData[];
}

export interface GridConfig {
  cols: number;
  rows: number;
}

export interface AppState {
  masterVolume: number;
  grid: GridConfig;
  tabs: TabData[];
  activeTabId: string;
  recentColors: string[];
  showSettings: boolean;
  isRecording: boolean;
  recordedSequence: RecordedEvent[];
}

export interface RecordedEvent {
  padId: string;
  time: number;
  action: 'play' | 'stop';
}

export const HOTKEYS = "12345678QWERTYUIASDFGHJKZXCVBNM".split("");

export const VIBRANT_COLORS = [
  '#f43f5e', '#ec4899', '#d946ef', '#8b5cf6', '#6366f1',
  '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'
];
