import { useRef, useCallback } from 'react';
import type { PadData, ActiveSource } from '../types';

export function useAudioEngine() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const getContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      masterGainRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioCtxRef.current.destination);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return {
      ctx: audioCtxRef.current,
      masterGain: masterGainRef.current!,
      analyser: analyserRef.current!
    };
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(vol, audioCtxRef.current!.currentTime);
    }
  }, []);

  const playPad = useCallback((pad: PadData, offset: number = 0): ActiveSource | null => {
    if (!pad.buffer) return null;
    const { ctx, masterGain } = getContext();

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = pad.buffer;
    source.loop = pad.loop;
    source.playbackRate.value = pad.speed;
    gainNode.gain.value = pad.volume;

    // Apply fade in
    if (pad.fadeTime > 0) {
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(pad.volume, ctx.currentTime + pad.fadeTime);
    }

    source.connect(gainNode);
    gainNode.connect(masterGain);

    const startTime = ctx.currentTime;
    source.start(0, offset);

    const sourceObj: ActiveSource = {
      source,
      gainNode,
      startTime,
      duration: pad.buffer.duration / pad.speed,
      offset
    };

    return sourceObj;
  }, [getContext]);

  const stopPad = useCallback((sources: ActiveSource[], fadeTime: number = 0) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    sources.forEach(s => {
      try {
        if (fadeTime > 0) {
          s.gainNode.gain.setValueAtTime(s.gainNode.gain.value, ctx.currentTime);
          s.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime);
          s.source.stop(ctx.currentTime + fadeTime + 0.05);
        } else {
          s.source.stop();
        }
      } catch (e) { /* already stopped */ }
    });
  }, []);

  const decodeAudioFile = useCallback(async (file: File): Promise<{ buffer: AudioBuffer; waveform: number[] }> => {
    const { ctx } = getContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const waveform = extractWaveform(buffer, 100);
    return { buffer, waveform };
  }, [getContext]);

  const extractWaveform = (buffer: AudioBuffer, samples: number): number[] => {
    const channelData = buffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      waveform.push(sum / blockSize);
    }

    // Normalize
    const max = Math.max(...waveform);
    if (max > 0) {
      return waveform.map(v => v / max);
    }
    return waveform;
  };

  const getCurrentTime = useCallback((sources: ActiveSource[], speed: number, loop: boolean, duration: number): number => {
    if (!audioCtxRef.current || sources.length === 0) return 0;
    const ctx = audioCtxRef.current;
    const lastSource = sources[sources.length - 1];
    let elapsed = (ctx.currentTime - lastSource.startTime) * speed + lastSource.offset;
    if (loop && duration > 0) {
      elapsed = elapsed % duration;
    }
    return Math.min(elapsed, duration);
  }, []);

  const getAnalyserData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  return {
    getContext,
    setMasterVolume,
    playPad,
    stopPad,
    decodeAudioFile,
    getCurrentTime,
    getAnalyserData
  };
}
