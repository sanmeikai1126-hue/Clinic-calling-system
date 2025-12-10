import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { AIProvider } from '../types';
import { MultimodalLiveClient } from '../services/liveClient';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

type RecordingContextValue = {
  isRecordingActive: boolean;
  setRecordingActive: (value: boolean) => void;
  selectedProvider: AIProvider;
  setSelectedProvider: (provider: AIProvider) => void;
  // Live Mode
  liveClient: MultimodalLiveClient | null;
  setLiveClient: (client: MultimodalLiveClient | null) => void;
  liveTranscription: string;
  setLiveTranscription: (text: string) => void;
  appendLiveTranscription: (text: string) => void;
  audioBlob: Blob | null;
  setAudioBlob: (blob: Blob | null) => void;
  // Recording Control
  startLiveRecording: (onData: (base64: string) => void) => Promise<void>;
  stopLiveRecording: () => Promise<void>;
};

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRecordingActive, setRecordingActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(AIProvider.GEMINI);
  const [liveClient, setLiveClient] = useState<MultimodalLiveClient | null>(null);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const lastChunkRef = useRef<{ text: string; ts: number; repeat: number }>({ text: '', ts: 0, repeat: 0 });

  const { startRecording, stopRecording, getAudioBlob } = useAudioRecorder();

  const appendLiveTranscription = (text: string) => {
    if (!text) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    // Detect obvious repetition spam like 「はいはいはい...」(long runs of the same token)
    const body = trimmed.replace(/[【】]/g, '').trim();
    const noSpaceBody = body.replace(/\s+/g, '');
    const hasLongCharRun = /(.)\1{5,}/.test(noSpaceBody); // same char 6連続
    const hasRepeatedPhrase = /^(.{1,4})\1{4,}$/.test(noSpaceBody); // 1〜4文字の繰り返しが5回以上
    if (body.length <= 40 && (hasLongCharRun || hasRepeatedPhrase)) {
      console.warn('[RecordingContext] Dropping repetitive chunk:', trimmed);
      return;
    }

    const now = Date.now();
    const isShort = trimmed.length <= 15; // short confirmations like 「うん」「はい」
    const isSameAsLast = trimmed === lastChunkRef.current.text;
    const withinWindow = now - lastChunkRef.current.ts < 6000; // 6秒以内の連続検出を重視

    if (isShort && isSameAsLast && withinWindow) {
      const nextRepeat = lastChunkRef.current.repeat + 1;
      lastChunkRef.current = { text: trimmed, ts: now, repeat: nextRepeat };
      // 6回目以降の同一短文はノイズとみなし破棄（5回までは許容）
      if (nextRepeat >= 6) {
        console.warn('[RecordingContext] Dropping repeated short chunk:', trimmed);
        return;
      }
    } else {
      lastChunkRef.current = { text: trimmed, ts: now, repeat: 1 };
    }

    setLiveTranscription(prev => prev + text);
  };

  const startLiveRecording = async (onData: (base64: string) => void) => {
    setAudioBlob(null); // Reset blob
    await startRecording(onData);
    setRecordingActive(true);
  };

  const stopLiveRecording = async () => {
    stopRecording();
    setRecordingActive(false);
    const blob = await getAudioBlob();
    if (blob) {
      console.log('[RecordingContext] Audio blob captured:', blob.size);
      setAudioBlob(blob);
    }
  };

  return (
    <RecordingContext.Provider value={{
      isRecordingActive,
      setRecordingActive,
      selectedProvider,
      setSelectedProvider,
      liveClient,
      setLiveClient,
      liveTranscription,
      setLiveTranscription,
      appendLiveTranscription,
      audioBlob,
      setAudioBlob,
      startLiveRecording,
      stopLiveRecording
    }}>
      {children}
    </RecordingContext.Provider>
  );
};

export const useRecordingStatus = () => {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error('useRecordingStatus must be used within a RecordingProvider');
  }
  return ctx;
};
