import { useState, useEffect, useCallback, useRef } from 'react';
import type { PadData, TabData, GridConfig, HotCue, RecordedEvent } from './types';
import { HOTKEYS, VIBRANT_COLORS } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';

// Utility functions
function hexToRgba(hex: string, opacity: number): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

let _idCounter = 0;
function generateId(): string {
  return `${Date.now().toString(36)}_${(++_idCounter).toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
}

function createEmptyPad(): PadData {
  return {
    id: generateId(),
    name: '',
    fileName: '',
    duration: 0,
    buffer: null,
    volume: 1,
    loop: false,
    color: '',
    fadeTime: 0,
    speed: 1,
    hotcues: [],
    activeSources: [],
    isPlaying: false,
    currentTime: 0,
    waveform: [],
    currentSourceId: null
  };
}

// Waveform Component
function WaveformDisplay({ waveform, progress, color }: { waveform: number[]; progress: number; color: string }) {
  if (waveform.length === 0) return null;
  const barColor = color || '#0ea5e9';

  return (
    <div className="flex items-end gap-[1px] h-8 w-full px-1">
      {waveform.map((val, i) => {
        const isActive = (i / waveform.length) <= progress;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] transition-colors duration-75"
            style={{
              height: `${Math.max(15, val * 100)}%`,
              backgroundColor: isActive ? barColor : 'rgba(255,255,255,0.15)',
              minWidth: '1px'
            }}
          />
        );
      })}
    </div>
  );
}

// Visualizer Component
function GlobalVisualizer({ getAnalyserData }: { getAnalyserData: () => Uint8Array | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const data = getAnalyserData();
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (data) {
        const barWidth = width / data.length;
        for (let i = 0; i < data.length; i++) {
          const barHeight = (data[i] / 255) * height;
          const hue = (i / data.length) * 180 + 180;
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [getAnalyserData]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="h-10 w-48 rounded-lg bg-black/40 border border-zinc-700/50"
    />
  );
}

// Pad Component
function Pad({
  pad,
  index,
  onPlay,
  onStop,
  onDrop,
  onClear,
  onToggleLoop,
  onVolumeChange,
  onSpeedChange,
  onFadeChange,
  onColorChange,
  onSeek,
  onAddHotcue,
  onClearHotcues,
  onHotcueClick,
  recentColors
}: {
  pad: PadData;
  index: number;
  onPlay: (id: string, offset?: number) => void;
  onStop: (id: string) => void;
  onDrop: (id: string, file: File) => void;
  onClear: (id: string) => void;
  onToggleLoop: (id: string) => void;
  onVolumeChange: (id: string, vol: number) => void;
  onSpeedChange: (id: string, speed: number) => void;
  onFadeChange: (id: string, fade: number) => void;
  onColorChange: (id: string, color: string) => void;
  onSeek: (id: string, percent: number) => void;
  onAddHotcue: (id: string) => void;
  onClearHotcues: (id: string) => void;
  onHotcueClick: (id: string, cue: HotCue) => void;
  recentColors: string[];
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hotkey = HOTKEYS[index] || '';
  const progress = pad.duration > 0 ? pad.currentTime / pad.duration : 0;
  const hasColor = !!pad.color;
  const padColor = pad.color || '#0ea5e9';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      onDrop(pad.id, file);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger play if clicking on controls or header areas
    if ((e.target as HTMLElement).closest('.pad-no-trigger')) return;
    if (pad.buffer) {
      if (pad.isPlaying) {
        onStop(pad.id);
      } else {
        onPlay(pad.id);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pad.id, percent);
  };

  return (
    <div
      className={`
        relative rounded-xl border p-3 flex flex-col min-h-[180px] cursor-pointer
        transition-all duration-150 select-none overflow-hidden group
        ${hasColor ? 'border-2' : 'border-zinc-700'}
        ${isDragOver ? 'border-sky-400 bg-sky-400/10' : ''}
        ${pad.isPlaying ? 'ring-2 ring-green-400/60 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''}
        ${pad.loop && pad.isPlaying ? 'ring-yellow-400/60 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : ''}
        ${!hasColor && !isDragOver ? 'bg-zinc-800/80 hover:bg-zinc-700/80 hover:border-zinc-500' : ''}
      `}
      style={hasColor ? {
        borderColor: padColor,
        backgroundColor: pad.isPlaying ? hexToRgba(padColor, 0.4) : hexToRgba(padColor, 0.12),
        boxShadow: pad.isPlaying ? `0 0 25px ${hexToRgba(padColor, 0.5)}, inset 0 0 15px ${hexToRgba(padColor, 0.2)}` : `0 0 8px ${hexToRgba(padColor, 0.2)}`
      } : {}}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Clear button */}
      {pad.buffer && (
        <button
          className="pad-no-trigger absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 border border-zinc-600 
            text-zinc-400 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 
            transition-opacity hover:bg-red-500 hover:text-white hover:border-red-500 z-10"
          onClick={(e) => { e.stopPropagation(); onClear(pad.id); }}
        >
          ✕
        </button>
      )}

      {/* Header */}
      <div className="pad-no-trigger flex items-center justify-between gap-2 mb-1" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={pad.color || '#000000'}
            onChange={(e) => onColorChange(pad.id, e.target.value)}
            className="w-5 h-5 rounded-full border border-zinc-600 cursor-pointer bg-transparent p-0 
              [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
            title="Color del pad"
          />
          {recentColors.slice(0, 3).map((c, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full border border-zinc-600 cursor-pointer hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
              onClick={(e) => { e.stopPropagation(); onColorChange(pad.id, c); }}
            />
          ))}
          {hasColor && (
            <button
              className="text-[10px] text-zinc-400 hover:text-red-400 px-1 rounded bg-black/30 border border-zinc-700"
              onClick={(e) => { e.stopPropagation(); onColorChange(pad.id, ''); }}
            >
              ↺
            </button>
          )}
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${hasColor ? 'bg-black/40 text-white' : 'bg-zinc-900 text-zinc-400'} border border-zinc-700`}>
          {pad.buffer ? formatTime(pad.duration) : '0:00'}
        </span>
      </div>

      {/* Name + Hotkey */}
      <div className="pad-no-trigger flex items-center gap-2 mb-1.5 bg-black/30 rounded-md px-2 py-1 border border-zinc-700/50" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <span className={`text-xs font-bold truncate flex-1 ${hasColor && pad.isPlaying ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-zinc-200'}`}>
          {pad.fileName || '--- Vacío ---'}
        </span>
        {hotkey && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${hasColor ? 'bg-black/50 text-white border-white/30' : 'bg-zinc-900 text-zinc-500 border-zinc-700'}`}>
            {hotkey}
          </span>
        )}
      </div>

      {/* Waveform / Dropzone */}
      <div className="flex-1 flex flex-col justify-center mb-1.5">
        {pad.buffer ? (
          <>
            <WaveformDisplay waveform={pad.waveform} progress={progress} color={pad.color} />
            {/* Hotcue markers */}
            {pad.hotcues.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {pad.hotcues.map((cue, i) => (
                  <button
                    key={i}
                    className="pad-no-trigger text-[9px] px-1.5 py-0.5 rounded font-bold border cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: hexToRgba(cue.color, 0.3), borderColor: cue.color, color: cue.color }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      e.preventDefault();
                      onHotcueClick(pad.id, cue); 
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {cue.label} {formatTime(cue.time)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-lg text-xs font-semibold
            ${isDragOver ? 'border-sky-400 text-sky-300 bg-sky-400/10' : 'border-zinc-600 text-zinc-500'}`}>
            {isDragOver ? '⬇ Soltar aquí' : '🎵 Arrastra audio'}
          </div>
        )}
      </div>

      {/* Progress bar - always visible */}
      <div
        className={`pad-no-trigger relative h-4 rounded overflow-hidden mb-1.5 border transition-colors
          ${pad.buffer ? 'bg-black/50 cursor-pointer border-zinc-700/50' : 'bg-zinc-900/50 cursor-default border-zinc-800'}`}
        onClick={pad.buffer ? handleSeek : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {pad.buffer && (
          <div
            className="absolute inset-y-0 left-0 transition-all duration-75"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: hasColor ? hexToRgba(padColor, 0.6) : '#0ea5e9'
            }}
          />
        )}
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]
          ${pad.buffer ? 'text-white' : 'text-zinc-600'}`}>
          {pad.buffer ? `-${formatTime(pad.duration - pad.currentTime)}` : '0:00'}
        </span>
      </div>

      {/* Controls */}
      <div className="pad-no-trigger" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-1">
          <button
            className={`w-7 h-7 rounded-md flex items-center justify-center text-sm border transition-all
              ${pad.loop ? 'bg-yellow-500 border-yellow-400 text-black shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-900 border-zinc-600 text-zinc-300 hover:bg-zinc-700'}`}
            onClick={(e) => { e.stopPropagation(); onToggleLoop(pad.id); }}
            title="Loop"
          >
            🔁
          </button>

          <button
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs bg-zinc-900 border border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            onClick={(e) => { e.stopPropagation(); onAddHotcue(pad.id); }}
            title="Añadir Hotcue en posición actual"
          >
            📍
          </button>

          {pad.hotcues.length > 0 && (
            <button
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs bg-zinc-900 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all"
              onClick={(e) => { e.stopPropagation(); onClearHotcues(pad.id); }}
              title={`Limpiar ${pad.hotcues.length} hotcue(s)`}
            >
              🗑
            </button>
          )}

          <button
            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs border transition-all
              ${showControls ? 'bg-sky-600 border-sky-500 text-white' : 'bg-zinc-900 border-zinc-600 text-zinc-300 hover:bg-zinc-700'}`}
            onClick={(e) => { e.stopPropagation(); setShowControls(!showControls); }}
            title="Más opciones"
          >
            ⚙
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-zinc-400">🔊</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.01"
              value={pad.volume}
              onChange={(e) => onVolumeChange(pad.id, parseFloat(e.target.value))}
              className="w-14 h-1 accent-sky-400"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Extended controls */}
        {showControls && pad.buffer && (
          <div className="mt-2 space-y-1.5 pt-2 border-t border-zinc-700/50 animate-in">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-12">Speed:</span>
              <input
                type="range"
                min="0.25"
                max="2"
                step="0.05"
                value={pad.speed}
                onChange={(e) => onSpeedChange(pad.id, parseFloat(e.target.value))}
                className="flex-1 h-1 accent-purple-400"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              />
              <span className="text-[10px] text-zinc-300 w-8 text-right">{pad.speed.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-12">Fade:</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={pad.fadeTime}
                onChange={(e) => onFadeChange(pad.id, parseFloat(e.target.value))}
                className="flex-1 h-1 accent-green-400"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              />
              <span className="text-[10px] text-zinc-300 w-8 text-right">{pad.fadeTime.toFixed(1)}s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [masterVolume, setMasterVolume] = useState(1);
  const [grid, setGrid] = useState<GridConfig>({ cols: 6, rows: 4 });
  const [tabs, setTabs] = useState<TabData[]>([{ id: generateId(), name: 'Bank 1', pads: [] }]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [recentColors, setRecentColors] = useState<string[]>(['#f43f5e', '#3b82f6', '#10b981', '#f59e0b']);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSequence, setRecordedSequence] = useState<RecordedEvent[]>([]);
  const [recordStartTime, setRecordStartTime] = useState(0);

  const audioEngine = useAudioEngine();
  const animFrameRef = useRef<number>(0);
  
  // Refs to always have the latest state in callbacks
  const tabsRef = useRef<TabData[]>(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const recordStartTimeRef = useRef(recordStartTime);
  recordStartTimeRef.current = recordStartTime;

  const activeTab = tabs.find(t => t.id === activeTabId)!;

  // Initialize pads for current tab
  useEffect(() => {
    const totalPads = grid.cols * grid.rows;
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    if (currentTab.pads.length < totalPads) {
      const newPads = [...currentTab.pads];
      while (newPads.length < totalPads) {
        newPads.push(createEmptyPad());
      }
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, pads: newPads } : t));
    } else if (currentTab.pads.length > totalPads) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, pads: currentTab.pads.slice(0, totalPads) } : t));
    }
  }, [grid, activeTabId]);

  // Progress update loop
  useEffect(() => {
    const update = () => {
      setTabs(prev => prev.map(tab => ({
        ...tab,
        pads: tab.pads.map(pad => {
          if (pad.activeSources.length > 0 && pad.buffer) {
            const currentTime = audioEngine.getCurrentTime(pad.activeSources, pad.speed, pad.loop, pad.duration);
            return { ...pad, currentTime };
          }
          return { ...pad, currentTime: 0 };
        })
      })));
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [audioEngine]);

  // ============================================================
  // CORE AUDIO CONTROL - Only ONE sound at a time, guaranteed
  // ============================================================
  
  // STOP EVERYTHING across all tabs - the nuclear option
  const stopEverything = useCallback(() => {
    const currentTabs = tabsRef.current;
    
    // Kill all audio sources immediately (onended is nulled inside stopPad)
    currentTabs.forEach(tab => {
      tab.pads.forEach(pad => {
        if (pad.activeSources.length > 0) {
          audioEngine.stopPad(pad.activeSources, 0);
        }
      });
    });
    
    // Reset ALL state atomically
    setTabs(prev => prev.map(t => ({
      ...t,
      pads: t.pads.map(p => ({ 
        ...p, 
        activeSources: [], 
        isPlaying: false, 
        currentTime: 0,
        currentSourceId: null
      }))
    })));
  }, [audioEngine]);

  // PLAY a pad - guarantees only one sound plays at a time
  const playPadExclusive = useCallback((padId: string, offset: number = 0) => {
    const currentTabs = tabsRef.current;
    const currentActiveTabId = activeTabIdRef.current;
    
    // Find the pad in current state
    const tab = currentTabs.find(t => t.id === currentActiveTabId);
    if (!tab) return;
    const pad = tab.pads.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;

    // STEP 1: Kill ALL existing audio across ALL tabs
    // This disconnects onended handlers so they won't fire
    currentTabs.forEach(t => {
      t.pads.forEach(p => {
        if (p.activeSources.length > 0) {
          audioEngine.stopPad(p.activeSources, 0);
        }
      });
    });

    // STEP 2: Create the new audio source
    const sourceObj = audioEngine.playPad(pad, offset);
    if (!sourceObj) return;

    const newSourceId = sourceObj.sourceId;

    // STEP 3: Update ALL state in ONE atomic operation
    setTabs(prev => prev.map(t => {
      if (t.id !== currentActiveTabId) {
        // Clear all other tabs completely
        return {
          ...t,
          pads: t.pads.map(p => ({ 
            ...p, 
            activeSources: [], 
            isPlaying: false, 
            currentTime: 0,
            currentSourceId: null
          }))
        };
      }
      // Update active tab: reset all pads, then activate the target
      return {
        ...t,
        pads: t.pads.map(p => {
          if (p.id === padId) {
            return { 
              ...p, 
              activeSources: [sourceObj], 
              isPlaying: true, 
              currentTime: offset,
              currentSourceId: newSourceId
            };
          }
          return { 
            ...p, 
            activeSources: [], 
            isPlaying: false, 
            currentTime: 0,
            currentSourceId: null
          };
        })
      };
    }));

    // STEP 4: Set onended handler that checks identity
    // Only clears state if THIS source is still the active one
    sourceObj.source.onended = () => {
      setTabs(prev => prev.map(t => {
        if (t.id !== currentActiveTabId) return t;
        return {
          ...t,
          pads: t.pads.map(p => {
            // Only clear if this source is still the current one for this pad
            if (p.id === padId && p.currentSourceId === newSourceId) {
              return { ...p, activeSources: [], isPlaying: false, currentSourceId: null };
            }
            return p;
          })
        };
      }));
    };
  }, [audioEngine]);

  // STOP a single pad
  const stopSinglePad = useCallback((padId: string) => {
    const currentTabs = tabsRef.current;
    const currentActiveTabId = activeTabIdRef.current;
    const tab = currentTabs.find(t => t.id === currentActiveTabId);
    if (!tab) return;
    const pad = tab.pads.find(p => p.id === padId);
    if (!pad || pad.activeSources.length === 0) return;

    // Stop audio (disconnects onended)
    audioEngine.stopPad(pad.activeSources, pad.fadeTime);

    // Update state
    setTabs(prev => prev.map(t => {
      if (t.id !== currentActiveTabId) return t;
      return {
        ...t,
        pads: t.pads.map(p => p.id === padId ? { 
          ...p, 
          activeSources: [], 
          isPlaying: false, 
          currentSourceId: null 
        } : p)
      };
    }));
  }, [audioEngine]);

  // Handle play from pad click or hotkey
  const handlePlayPad = useCallback((padId: string, offset?: number) => {
    const currentTabs = tabsRef.current;
    const currentActiveTabId = activeTabIdRef.current;
    const tab = currentTabs.find(t => t.id === currentActiveTabId);
    if (!tab) return;
    const pad = tab.pads.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;

    // If clicking same pad that's playing without offset → toggle stop
    if (pad.isPlaying && offset === undefined) {
      stopSinglePad(padId);
      return;
    }

    // Record event if recording
    if (isRecordingRef.current) {
      setRecordedSequence(prev => [...prev, {
        padId,
        time: Date.now() - recordStartTimeRef.current,
        action: 'play'
      }]);
    }

    // Play exclusively (stops everything else)
    playPadExclusive(padId, offset);
  }, [playPadExclusive, stopSinglePad]);

  // Handle stop for a single pad
  const handleStopPad = useCallback((padId: string) => {
    stopSinglePad(padId);
  }, [stopSinglePad]);

  // Handle STOP ALL button
  const handleStopAll = useCallback(() => {
    stopEverything();
  }, [stopEverything]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      const key = e.key.toUpperCase();
      
      // Space = stop all
      if (e.code === 'Space') {
        e.preventDefault();
        stopEverything();
        return;
      }
      
      // Ctrl+R = toggle recording
      if (key === 'R' && e.ctrlKey) {
        e.preventDefault();
        setIsRecording(prev => {
          if (!prev) {
            setRecordedSequence([]);
            setRecordStartTime(Date.now());
          }
          return !prev;
        });
        return;
      }
      
      // Hotkeys for pads
      const index = HOTKEYS.indexOf(key);
      if (index !== -1) {
        const currentTabs = tabsRef.current;
        const currentActiveTabId = activeTabIdRef.current;
        const tab = currentTabs.find(t => t.id === currentActiveTabId);
        if (tab && tab.pads[index] && tab.pads[index].buffer) {
          const pad = tab.pads[index];
          if (pad.isPlaying) {
            stopSinglePad(pad.id);
          } else {
            playPadExclusive(pad.id);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stopEverything, stopSinglePad, playPadExclusive]);

  // Save to localStorage
  useEffect(() => {
    const saveData = {
      grid,
      tabs: tabs.map(t => ({
        id: t.id,
        name: t.name,
        pads: t.pads.map(p => ({
          id: p.id, name: p.name, fileName: p.fileName, duration: p.duration,
          volume: p.volume, loop: p.loop, color: p.color, fadeTime: p.fadeTime,
          speed: p.speed, hotcues: p.hotcues, waveform: p.waveform
        }))
      })),
      activeTabId,
      recentColors
    };
    localStorage.setItem('soundpad_pro_state', JSON.stringify(saveData));
  }, [tabs, grid, activeTabId, recentColors]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('soundpad_pro_state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.grid) setGrid(data.grid);
        if (data.tabs) {
          setTabs(data.tabs.map((t: any) => ({
            ...t,
            pads: t.pads.map((p: any) => ({
              ...createEmptyPad(),
              ...p,
              buffer: null,
              activeSources: [],
              isPlaying: false,
              currentTime: 0,
              currentSourceId: null
            }))
          })));
        }
        if (data.activeTabId) setActiveTabId(data.activeTabId);
        if (data.recentColors) setRecentColors(data.recentColors);
      } catch (e) { /* ignore */ }
    }
  }, []);

  const handleDrop = useCallback(async (padId: string, file: File) => {
    audioEngine.getContext();
    const { buffer, waveform } = await audioEngine.decodeAudioFile(file);
    const randomColor = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];

    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? {
        ...p,
        buffer,
        fileName: file.name,
        duration: buffer.duration,
        waveform,
        color: p.color || randomColor
      } : p)
    } : t));
  }, [activeTabId, audioEngine]);

  const handleClearPad = useCallback((padId: string) => {
    stopSinglePad(padId);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? {
        ...p, buffer: null, fileName: '', duration: 0, waveform: [], color: '', hotcues: [], currentSourceId: null
      } : p)
    } : t));
  }, [activeTabId, stopSinglePad]);

  const handleToggleLoop = useCallback((padId: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => {
        if (p.id !== padId) return p;
        const newLoop = !p.loop;
        p.activeSources.forEach(s => { s.source.loop = newLoop; });
        return { ...p, loop: newLoop };
      })
    } : t));
  }, [activeTabId]);

  const handleVolumeChange = useCallback((padId: string, vol: number) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => {
        if (p.id !== padId) return p;
        p.activeSources.forEach(s => { s.gainNode.gain.value = vol; });
        return { ...p, volume: vol };
      })
    } : t));
  }, [activeTabId]);

  const handleSpeedChange = useCallback((padId: string, speed: number) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => {
        if (p.id !== padId) return p;
        p.activeSources.forEach(s => { s.source.playbackRate.value = speed; });
        return { ...p, speed };
      })
    } : t));
  }, [activeTabId]);

  const handleFadeChange = useCallback((padId: string, fadeTime: number) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? { ...p, fadeTime } : p)
    } : t));
  }, [activeTabId]);

  const handleColorChange = useCallback((padId: string, color: string) => {
    if (color && !recentColors.includes(color)) {
      setRecentColors(prev => [color, ...prev.slice(0, 3)]);
    }
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? { ...p, color } : p)
    } : t));
  }, [activeTabId, recentColors]);

  const handleSeek = useCallback((padId: string, percent: number) => {
    const currentTabs = tabsRef.current;
    const currentActiveTabId = activeTabIdRef.current;
    const tab = currentTabs.find(t => t.id === currentActiveTabId);
    if (!tab) return;
    const pad = tab.pads.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;
    const offset = percent * pad.duration;
    // Play from seek position (stops everything else first)
    playPadExclusive(padId, offset);
  }, [playPadExclusive]);

  const handleAddHotcue = useCallback((padId: string) => {
    const currentTabs = tabsRef.current;
    const currentActiveTabId = activeTabIdRef.current;
    const tab = currentTabs.find(t => t.id === currentActiveTabId);
    if (!tab) return;
    const pad = tab.pads.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;

    const time = pad.currentTime || 0;
    const color = VIBRANT_COLORS[pad.hotcues.length % VIBRANT_COLORS.length];
    const hotcue: HotCue = { time, color, label: `${pad.hotcues.length + 1}` };

    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? { ...p, hotcues: [...p.hotcues, hotcue] } : p)
    } : t));
  }, [activeTabId]);

  const handleClearHotcues = useCallback((padId: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      pads: t.pads.map(p => p.id === padId ? { ...p, hotcues: [] } : p)
    } : t));
  }, [activeTabId]);

  // Hotcue click - plays from that position (stops everything else first, ONE sound only)
  const handleHotcueClick = useCallback((padId: string, cue: HotCue) => {
    playPadExclusive(padId, cue.time);
  }, [playPadExclusive]);

  const handleMasterVolume = useCallback((vol: number) => {
    setMasterVolume(vol);
    audioEngine.setMasterVolume(vol);
  }, [audioEngine]);

  const addTab = () => {
    stopEverything();
    const newTab: TabData = { id: generateId(), name: `Bank ${tabs.length + 1}`, pads: [] };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const deleteTab = (id: string) => {
    if (tabs.length <= 1) return;
    stopEverything();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  const renameTab = (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const newName = prompt('Nombre de la pestaña:', tab.name);
    if (newName) {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setRecordedSequence([]);
      setRecordStartTime(Date.now());
      setIsRecording(true);
    }
  };

  const playRecordedSequence = () => {
    if (recordedSequence.length === 0) return;
    recordedSequence.forEach(event => {
      setTimeout(() => {
        if (event.action === 'play') {
          playPadExclusive(event.padId);
        }
      }, event.time);
    });
  };

  const exportConfig = () => {
    const exportData = {
      grid,
      tabs: tabs.map(t => ({
        id: t.id,
        name: t.name,
        pads: t.pads.map(p => ({
          id: p.id, name: p.name, fileName: p.fileName, duration: p.duration,
          volume: p.volume, loop: p.loop, color: p.color, fadeTime: p.fadeTime,
          speed: p.speed, hotcues: p.hotcues, waveform: p.waveform
        }))
      })),
      recentColors
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'soundpad_pro_config.json';
    a.click();
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopEverything();
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.grid) setGrid(data.grid);
        if (data.tabs) {
          setTabs(data.tabs.map((t: any) => ({
            ...t,
            pads: t.pads.map((p: any) => ({
              ...createEmptyPad(),
              ...p,
              buffer: null,
              activeSources: [],
              isPlaying: false,
              currentTime: 0,
              currentSourceId: null
            }))
          })));
        }
        if (data.recentColors) setRecentColors(data.recentColors);
        if (data.tabs?.[0]) setActiveTabId(data.tabs[0].id);
      } catch (err) {
        alert('Error al importar');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-screen flex flex-col bg-[#09090b] text-white overflow-hidden">
      {/* Header */}
      <header className="bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">
        <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-sky-400 to-purple-400 bg-clip-text text-transparent mr-2">
          🎛️ SoundPad Pro
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-sm font-medium
                border transition-all whitespace-nowrap
                ${tab.id === activeTabId
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(14,165,233,0.2)]'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              onClick={() => { stopEverything(); setActiveTabId(tab.id); }}
              onDoubleClick={() => renameTab(tab.id)}
            >
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <span
                  className="text-xs opacity-50 hover:opacity-100 hover:text-red-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }}
                >
                  ✕
                </span>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 text-sm transition-all"
          >
            +
          </button>
        </div>

        {/* Visualizer */}
        <GlobalVisualizer getAnalyserData={audioEngine.getAnalyserData} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={exportConfig} className="btn-action" title="Exportar configuración">
            💾
          </button>
          <label className="btn-action cursor-pointer" title="Importar configuración">
            📂
            <input type="file" accept=".json" className="hidden" onChange={importConfig} />
          </label>
          <button
            onClick={toggleRecording}
            className={`btn-action ${isRecording ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : ''}`}
            title="Grabar secuencia (Ctrl+R)"
          >
            {isRecording ? '⏺' : '🔴'}
          </button>
          {recordedSequence.length > 0 && !isRecording && (
            <button onClick={playRecordedSequence} className="btn-action" title="Reproducir secuencia">
              ▶️
            </button>
          )}
          <button
            onClick={handleStopAll}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 
              hover:bg-red-500/30 font-bold text-sm transition-all hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]
              active:scale-95"
            title="Detener TODOS los sonidos (Espacio)"
          >
            ⏹ STOP ALL
          </button>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="bg-zinc-900/70 border-b border-zinc-800 px-4 py-2 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 font-medium">Cols:</label>
          <input
            type="number"
            min={1}
            max={12}
            value={grid.cols}
            onChange={e => setGrid({ ...grid, cols: parseInt(e.target.value) || 6 })}
            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 font-medium">Filas:</label>
          <input
            type="number"
            min={1}
            max={12}
            value={grid.rows}
            onChange={e => setGrid({ ...grid, rows: parseInt(e.target.value) || 4 })}
            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">🔊 Master:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={e => handleMasterVolume(parseFloat(e.target.value))}
            className="w-24 h-1.5 accent-sky-400"
          />
          <span className="text-xs text-zinc-300 font-mono w-8">{Math.round(masterVolume * 100)}%</span>
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">REC {recordedSequence.length} events</span>
          </div>
        )}

        <div className="text-[10px] text-zinc-600 hidden md:block">
          Espacio = Stop All | Ctrl+R = Grabar
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
          gap: '12px',
          alignContent: 'start'
        }}
      >
        {activeTab.pads.map((pad, index) => (
          <Pad
            key={pad.id}
            pad={pad}
            index={index}
            onPlay={handlePlayPad}
            onStop={handleStopPad}
            onDrop={handleDrop}
            onClear={handleClearPad}
            onToggleLoop={handleToggleLoop}
            onVolumeChange={handleVolumeChange}
            onSpeedChange={handleSpeedChange}
            onFadeChange={handleFadeChange}
            onColorChange={handleColorChange}
            onSeek={handleSeek}
            onAddHotcue={handleAddHotcue}
            onClearHotcues={handleClearHotcues}
            onHotcueClick={handleHotcueClick}
            recentColors={recentColors}
          />
        ))}
      </div>
    </div>
  );
}
