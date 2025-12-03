import React, { useState } from 'react';
import { Activity, List, Mic, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ApiKeyModal from './ApiKeyModal';
import { useRecordingStatus } from '../contexts/RecordingContext';

type NavTone = 'sky' | 'rose' | 'slate';

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: NavTone;
  match?: string[];
  highlight?: boolean;
};

const toneStyles: Record<NavTone, { active: string; inactive: string; indicator: string }> = {
  sky: {
    active: 'bg-white text-sky-800 border-sky-300 shadow-[0_10px_30px_rgba(14,165,233,0.18)]',
    inactive: 'text-sky-700/80 border-sky-100 hover:border-sky-200 hover:bg-white',
    indicator: 'bg-sky-500 shadow-[0_4px_12px_rgba(14,165,233,0.35)]'
  },
  rose: {
    active: 'bg-white text-rose-800 border-rose-300 shadow-[0_10px_30px_rgba(244,63,94,0.28)]',
    inactive: 'text-rose-700 border-rose-200/80 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50',
    indicator: 'bg-rose-500 shadow-[0_4px_12px_rgba(244,63,94,0.35)]'
  },
  slate: {
    active: 'bg-white text-slate-800 border-slate-300 shadow-[0_10px_30px_rgba(148,163,184,0.16)]',
    inactive: 'text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-white',
    indicator: 'bg-slate-500 shadow-[0_4px_12px_rgba(148,163,184,0.28)]'
  }
};

const navItems: NavItem[] = [
  {
    to: '/',
    label: '呼び出し',
    description: 'フロア案内',
    icon: Activity,
    tone: 'sky'
  },
  {
    to: '/record',
    label: '録音',
    description: '診察が始まったらここ',
    icon: Mic,
    tone: 'rose',
    match: ['/record', '/result'],
    highlight: true
  },
  {
    to: '/history',
    label: '履歴',
    description: '記録一覧',
    icon: List,
    tone: 'slate'
  }
];

const Header: React.FC = () => {
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isRecordingActive } = useRecordingStatus();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-teal-700 hover:text-teal-800 transition">
            <div className="bg-teal-600 text-white p-1.5 rounded-lg">
              <Activity size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MediVoice AI</h1>
          </Link>

          <nav className="flex-1 flex justify-center">
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 py-1.5 shadow-inner overflow-hidden max-w-full">
              {navItems.map((item) => {
                const isActive = item.match?.some(path => location.pathname.startsWith(path)) || location.pathname === item.to;
                const isRecordingTab = item.highlight;
                const styles = toneStyles[item.tone];
                const Icon = item.icon;
                const iconRing = isRecordingTab && isRecordingActive
                  ? 'bg-rose-50 border-rose-200 shadow-[0_8px_24px_rgba(244,63,94,0.2)]'
                  : 'bg-white/80 border border-gray-200 shadow-sm';
                const statusPill = isRecordingTab ? (
                  <span
                    className={`ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      isRecordingActive
                        ? 'bg-rose-500/10 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isRecordingActive
                          ? 'bg-rose-500 animate-pulse shadow-[0_0_0_5px_rgba(244,63,94,0.28)]'
                          : 'bg-slate-300'
                      }`}
                    />
                    {isRecordingActive ? 'REC' : 'OFF'}
                  </span>
                ) : null;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative min-w-[190px] flex items-center gap-3 px-4 py-2.5 rounded-full border font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 ${isActive ? styles.active : styles.inactive}`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${iconRing}`}>
                      <Icon size={18} className="text-current" />
                    </div>
                    <div className="flex flex-col leading-tight text-left">
                      <span>{item.label}</span>
                      <span className="text-[11px] font-normal text-gray-500 group-hover:text-gray-600">
                        {item.description}
                      </span>
                    </div>
                    {statusPill}
                    <span
                      className={`absolute inset-x-4 -bottom-2 h-1 rounded-full transition ${
                        isActive
                          ? `${styles.indicator}`
                          : 'bg-gray-300/70 opacity-0 group-hover:opacity-80 group-hover:bg-gray-400/80'
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </nav>

          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 text-gray-500 hover:text-teal-700 hover:bg-gray-100 rounded-full transition"
            title="API Key Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default Header;
