import { useCallback, useRef } from 'react';

interface UseSoundOptions {
  volume?: number;
  playbackRate?: number;
}

export function useSound(src: string, options: UseSoundOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { volume = 1, playbackRate = 1 } = options;

  const play = useCallback(() => {
    try {
      if (audioRef.current === null) {
        audioRef.current = new Audio(src);
      }
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      // Silently fail if audio not supported
    }
  }, [src, volume, playbackRate]);

  const stop = useCallback(() => {
    if (audioRef.current !== null) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { play, stop };
}

export default useSound;
