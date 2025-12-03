import React, { createContext, useContext, useState, ReactNode } from 'react';

type RecordingContextValue = {
  isRecordingActive: boolean;
  setRecordingActive: (value: boolean) => void;
};

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRecordingActive, setRecordingActive] = useState(false);

  return (
    <RecordingContext.Provider value={{ isRecordingActive, setRecordingActive }}>
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

