
import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerState {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
  volume: number;
  setVolume: (volume: number) => void;
  play: (src: string, onEnded?: () => void) => void;
  stop: () => void;
}

export const useAudioPlayer = (initialVolume: number = 0.8): AudioPlayerState & { play: (src: string, onEnded?: () => void) => void } => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(initialVolume);
  const onEndedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = initialVolume;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEndedRef.current) {
        onEndedRef.current();
        onEndedRef.current = null;
      }
    };
    const handleError = () => {
      setError('音声が見つかりません');
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      onEndedRef.current = null;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [initialVolume]);

  const play = useCallback((src: string, onEnded?: () => void) => {
    if (audioRef.current) {
      setError(null);
      setCurrentTime(0);
      setDuration(0);
      // If a sound is already playing, stop it before starting the new one.
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      onEndedRef.current = onEnded || null;

      audioRef.current.src = src;
      audioRef.current.play().catch(() => {
        setError('音声の再生に失敗しました。');
        setIsPlaying(false);
        onEndedRef.current = null;
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      onEndedRef.current = null;
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  useEffect(() => {
    setVolume(initialVolume);
  }, [initialVolume, setVolume]);


  return { isPlaying, duration, currentTime, error, volume, setVolume, play, stop };
};
