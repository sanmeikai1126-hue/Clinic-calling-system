import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AIProvider } from '../types';
import { MultimodalLiveClient } from '../services/liveClient';

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
};

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRecordingActive, setRecordingActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(AIProvider.OPENAI);
  const [liveClient, setLiveClient] = useState<MultimodalLiveClient | null>(null);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const appendLiveTranscription = (text: string) => {
    setLiveTranscription(prev => prev + text);
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
      setAudioBlob
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
