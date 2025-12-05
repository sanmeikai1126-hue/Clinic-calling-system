import React, { createContext, useContext, useState, ReactNode } from 'react';
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
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(AIProvider.OPENAI);
  const [liveClient, setLiveClient] = useState<MultimodalLiveClient | null>(null);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const { startRecording, stopRecording, getAudioBlob } = useAudioRecorder();

  const appendLiveTranscription = (text: string) => {
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
