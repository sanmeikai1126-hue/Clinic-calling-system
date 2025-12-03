import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import CallingPage from './pages/CallingPage';
import RecordPage from './pages/RecordPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import { ApiKeyProvider } from './contexts/ApiKeyContext';
import { RecordingProvider } from './contexts/RecordingContext';

const App: React.FC = () => {
  return (
    <ApiKeyProvider>
      <RecordingProvider>
        <HashRouter>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 bg-gradient-to-b from-slate-50 via-white to-slate-100 px-3 pb-10">
              <Routes>
                <Route path="/" element={<CallingPage />} />
                <Route path="/record" element={<RecordPage />} />
                <Route path="/result" element={<ResultPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
      </RecordingProvider>
    </ApiKeyProvider>
  );
};

export default App;
