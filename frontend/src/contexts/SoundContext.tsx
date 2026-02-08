'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * SoundContext - Global Sound Manager
 * 
 * Architecture:
 * - Settings Modal (Master Toggle) → writes to localStorage → SoundContext reads it
 * - Game-level toggle → overrides locally, but respects Master
 * - If Master is OFF → everything is silent regardless of game toggle
 * - If Master is ON → game toggle controls game-specific sounds
 * 
 * localStorage keys:
 * - 'soundEnabled' → Master sound toggle (from Settings)
 * - 'musicEnabled' → Background music toggle (from Settings)
 * - 'clientSeed'   → Provably fair client seed (from Settings)
 */

interface SoundContextType {
  // Master controls (from Settings)
  masterSoundEnabled: boolean;
  masterMusicEnabled: boolean;
  
  // Game-level controls
  gameSoundEnabled: boolean;
  
  // Computed: is sound actually active? (master AND game)
  isSoundActive: boolean;
  
  // Actions
  setMasterSound: (enabled: boolean) => void;
  setMasterMusic: (enabled: boolean) => void;
  toggleGameSound: () => void;
  
  // Client seed (shared between Settings and games)
  clientSeed: string;
  setClientSeed: (seed: string) => void;
  
  // Audio playback
  playSound: (type: 'tick' | 'crash' | 'win' | 'bet' | 'drop' | 'bucket' | 'ding') => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

export const useSoundContext = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSoundContext must be used within a SoundProvider');
  }
  return context;
};

// Safe hook that returns defaults if not wrapped in provider
export const useSoundContextSafe = () => {
  const context = useContext(SoundContext);
  if (!context) {
    return {
      masterSoundEnabled: true,
      masterMusicEnabled: false,
      gameSoundEnabled: true,
      isSoundActive: true,
      setMasterSound: () => {},
      setMasterMusic: () => {},
      toggleGameSound: () => {},
      clientSeed: '',
      setClientSeed: () => {},
      playSound: () => {},
    };
  }
  return context;
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Master controls (synced with localStorage)
  const [masterSoundEnabled, setMasterSoundEnabled] = useState(true);
  const [masterMusicEnabled, setMasterMusicEnabled] = useState(false);
  
  // Game-level override
  const [gameSoundEnabled, setGameSoundEnabled] = useState(true);
  
  // Client seed
  const [clientSeed, setClientSeedState] = useState('');
  
  // Audio context ref
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedSound = localStorage.getItem('soundEnabled');
    const savedMusic = localStorage.getItem('musicEnabled');
    const savedSeed = localStorage.getItem('clientSeed');
    
    if (savedSound !== null) setMasterSoundEnabled(savedSound === 'true');
    if (savedMusic !== null) setMasterMusicEnabled(savedMusic === 'true');
    if (savedSeed) setClientSeedState(savedSeed);
  }, []);

  // Listen for localStorage changes from other tabs/components
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'soundEnabled' && e.newValue !== null) {
        setMasterSoundEnabled(e.newValue === 'true');
      }
      if (e.key === 'musicEnabled' && e.newValue !== null) {
        setMasterMusicEnabled(e.newValue === 'true');
      }
      if (e.key === 'clientSeed' && e.newValue !== null) {
        setClientSeedState(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Also poll localStorage periodically to catch same-tab changes from SettingsModal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const interval = setInterval(() => {
      const savedSound = localStorage.getItem('soundEnabled');
      const savedMusic = localStorage.getItem('musicEnabled');
      const savedSeed = localStorage.getItem('clientSeed');
      
      if (savedSound !== null) {
        const val = savedSound === 'true';
        setMasterSoundEnabled(prev => prev !== val ? val : prev);
      }
      if (savedMusic !== null) {
        const val = savedMusic === 'true';
        setMasterMusicEnabled(prev => prev !== val ? val : prev);
      }
      if (savedSeed) {
        setClientSeedState(prev => prev !== savedSeed ? savedSeed : prev);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  // Computed: sound is active only if BOTH master and game toggles are on
  const isSoundActive = masterSoundEnabled && gameSoundEnabled;

  // Actions
  const setMasterSound = useCallback((enabled: boolean) => {
    setMasterSoundEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', String(enabled));
    }
  }, []);

  const setMasterMusic = useCallback((enabled: boolean) => {
    setMasterMusicEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('musicEnabled', String(enabled));
    }
  }, []);

  const toggleGameSound = useCallback(() => {
    setGameSoundEnabled(prev => !prev);
  }, []);

  const setClientSeed = useCallback((seed: string) => {
    setClientSeedState(seed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('clientSeed', seed);
    }
  }, []);

  // Universal sound player
  const playSound = useCallback((type: 'tick' | 'crash' | 'win' | 'bet' | 'drop' | 'bucket' | 'ding') => {
    try {
      if (!isSoundActive || !audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      switch (type) {
        case 'tick':
          oscillator.frequency.value = 800 + Math.random() * 200;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.05;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.05);
          break;
        case 'crash':
          oscillator.frequency.value = 150;
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;
        case 'win':
        case 'ding':
          oscillator.frequency.value = 523.25;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.2;
          oscillator.start();
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'bet':
          oscillator.frequency.value = 440;
          oscillator.type = 'square';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.1);
          break;
        case 'drop':
          oscillator.frequency.value = 600;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.08;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.06);
          break;
        case 'bucket':
          oscillator.frequency.value = 400;
          oscillator.type = 'triangle';
          gainNode.gain.value = 0.15;
          oscillator.start();
          oscillator.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
          oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
          oscillator.stop(ctx.currentTime + 0.2);
          break;
      }
    } catch (e) {
      console.warn('Sound playback failed:', e);
    }
  }, [isSoundActive]);

  return (
    <SoundContext.Provider
      value={{
        masterSoundEnabled,
        masterMusicEnabled,
        gameSoundEnabled,
        isSoundActive,
        setMasterSound,
        setMasterMusic,
        toggleGameSound,
        clientSeed,
        setClientSeed,
        playSound,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export default SoundContext;
