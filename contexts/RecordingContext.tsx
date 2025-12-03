import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AIProvider } from '../types';

type RecordingContextValue = {
  isRecordingActive: boolean;
  setRecordingActive: (value: boolean) => void;
  selectedProvider: AIProvider;
  setSelectedProvider: (provider: AIProvider) => void;
};

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRecordingActive, setRecordingActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(AIProvider.OPENAI);

  return (
    <RecordingContext.Provider value={{ isRecordingActive, setRecordingActive, selectedProvider, setSelectedProvider }}>
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
