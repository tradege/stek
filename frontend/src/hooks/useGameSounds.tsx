'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SoundConfig {
  tick: string;
  crash: string;
  win: string;
  bet: string;
  cashout: string;
  countdown: string;
}

// Default sound URLs (using free placeholder sounds)
const DEFAULT_SOUNDS: SoundConfig = {
  tick: '/sounds/tick.mp3',
  crash: '/sounds/crash.mp3',
  win: '/sounds/win.mp3',
  bet: '/sounds/bet.mp3',
  cashout: '/sounds/cashout.mp3',
  countdown: '/sounds/countdown.mp3',
};

interface UseGameSoundsOptions {
  enabled?: boolean;
  volume?: number;
}

export function useGameSounds(options: UseGameSoundsOptions = {}) {
  const { enabled: initialEnabled = true, volume: initialVolume = 0.5 } = options;
  
  const [isMuted, setIsMuted] = useState(!initialEnabled);
  const [volume, setVolume] = useState(initialVolume);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const tickCountRef = useRef(0);

  // Initialize audio elements
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create audio elements for each sound
    Object.entries(DEFAULT_SOUNDS).forEach(([key, src]) => {
      const audio = new Audio();
      audio.src = src;
      audio.preload = 'auto';
      audio.volume = volume;
      audioRefs.current[key] = audio;
    });

    // Load from localStorage
    const savedMuted = localStorage.getItem('game_sounds_muted');
    const savedVolume = localStorage.getItem('game_sounds_volume');
    
    if (savedMuted !== null) {
      setIsMuted(savedMuted === 'true');
    }
    if (savedVolume !== null) {
      setVolume(parseFloat(savedVolume));
    }

    return () => {
      // Cleanup
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  // Update volume on all audio elements
  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) {
        audio.volume = isMuted ? 0 : volume;
      }
    });
  }, [volume, isMuted]);

  // Play a sound
  const playSound = useCallback(
    (soundName: keyof SoundConfig) => {
      if (isMuted || typeof window === 'undefined') return;

      const audio = audioRefs.current[soundName];
      if (audio) {
        // Reset and play
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    },
    [isMuted]
  );

  // Sound event handlers
  const playTick = useCallback(() => {
    tickCountRef.current += 1;
    // Only play tick sound every 10 ticks
    if (tickCountRef.current % 10 === 0) {
      playSound('tick');
    }
  }, [playSound]);

  const playCrash = useCallback(() => {
    tickCountRef.current = 0;
    playSound('crash');
  }, [playSound]);

  const playWin = useCallback(() => {
    playSound('win');
  }, [playSound]);

  const playBet = useCallback(() => {
    playSound('bet');
  }, [playSound]);

  const playCashout = useCallback(() => {
    playSound('cashout');
  }, [playSound]);

  const playCountdown = useCallback(() => {
    playSound('countdown');
  }, [playSound]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newValue = !prev;
      localStorage.setItem('game_sounds_muted', String(newValue));
      return newValue;
    });
  }, []);

  // Set volume
  const updateVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    localStorage.setItem('game_sounds_volume', String(clampedVolume));
  }, []);

  // Reset tick counter (for new round)
  const resetTicks = useCallback(() => {
    tickCountRef.current = 0;
  }, []);

  return {
    // State
    isMuted,
    volume,
    
    // Controls
    toggleMute,
    setVolume: updateVolume,
    
    // Sound triggers
    playTick,
    playCrash,
    playWin,
    playBet,
    playCashout,
    playCountdown,
    playSound,
    
    // Utilities
    resetTicks,
  };
}

// Sound button component for easy integration
export function SoundToggleButton() {
  const { isMuted, toggleMute, volume, setVolume } = useGameSounds();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={toggleMute}
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
        className={`p-2 rounded-lg transition-all ${
          isMuted
            ? 'bg-white/5 text-text-secondary hover:text-white'
            : 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
        }`}
        title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {isMuted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        )}
      </button>

      {/* Volume Slider */}
      {showVolumeSlider && !isMuted && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-bg-card rounded-lg border border-white/10 shadow-xl"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="text-xs text-text-secondary text-center mt-1">
            {Math.round(volume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}

export default useGameSounds;
