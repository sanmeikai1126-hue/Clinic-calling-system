
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Division, LogEntry, AIProvider } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Numpad } from '../components/Numpad';
import { StatusDisplay } from '../components/StatusDisplay';
import { LogViewer } from '../components/LogViewer';
import { Icon } from '../components/Icon';
import { getDivisionAudioRange, getDivisionAudioSource, getStaffCallAudioSource } from '../audioSources';
import {
    DIVISION_LABELS,
    MAX_HISTORY,
    MAX_LOGS,
    MAX_NUMBER,
} from '../constants';
import { useNavigate } from 'react-router-dom';
import { useRecordingStatus } from '../contexts/RecordingContext';


const SpeakerIcon = () => <Icon path="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06zM20.932 2.758a.75.75 0 011.061 0 13.5 13.5 0 010 18.484.75.75 0 01-1.06-1.061 12 12 0 000-16.362.75.75 0 010-1.06z" className="w-6 h-6 mr-2" />
const RepeatIcon = () => <Icon path="M16.023 9.348h4.992v-.001a.75.75 0 01.75.75v3.496a.75.75 0 01-1.5 0v-2.251h-3.988a4.502 4.502 0 01-1.464 2.98l.834.834a.75.75 0 11-1.06 1.06l-1.5-1.5a.75.75 0 010-1.06l1.5-1.5a.75.75 0 111.06 1.06l-.833.834a3.001 3.001 0 001.464-2.58h-.001zM2.977 15.348H7.969v.001a.75.75 0 00.75-.75V11.1a.75.75 0 00-1.5 0v2.25H4.012a4.502 4.502 0 011.464-2.98l-.834-.834a.75.75 0 10-1.06-1.06l-1.5 1.5a.75.75 0 000 1.06l1.5 1.5a.75.75 0 101.06-1.06l.833-.834a3.001 3.001 0 00-1.464 2.58h.001z" className="w-6 h-6 mr-2" />
const StopIcon = () => <Icon path="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-6 h-6 mr-2" />


const STAFF_CALL_ANNOUNCEMENT = 'スタッフをお呼び出し中';
const STAFF_CALL_NUMBER = 'スタッフ';


export default function CallingPage() {
    const [number, setNumber] = useState<string>('');
    const [lastCall, setLastCall] = useState<{ number: string; division: Division } | null>(null);
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const navigate = useNavigate();
    const { selectedProvider, setSelectedProvider } = useRecordingStatus();

    const [volume, setVolume] = useLocalStorage('clinic-call-volume', 0.8);
    const [history, setHistory] = useLocalStorage<string[]>('clinic-call-history', []);
    const [logs, setLogs] = useLocalStorage<LogEntry[]>('clinic-call-logs', []);

    const audio = useAudioPlayer(volume);
    const mainInputRef = useRef<HTMLInputElement>(null);

    const addLog = useCallback((log: Omit<LogEntry, 'timestamp'>) => {
        const newLog: LogEntry = {
            ...log,
            timestamp: new Date().toLocaleString(),
        };
        setLogs(prev => [newLog, ...prev.slice(0, MAX_LOGS - 1)]);
    }, [setLogs]);

    useEffect(() => {
        if (audio.error) {
            setAnnouncement(null);
            if (lastCall) {
                addLog({
                    number: lastCall.number,
                    division: lastCall.division,
                    status: 'error',
                    message: `再生エラー: ${lastCall.number}番 (${DIVISION_LABELS[lastCall.division]}) - ${audio.error}`
                });
            }
        }
    }, [audio.error, addLog, lastCall]);

    const handlePlay = useCallback((division: Division) => {
        const numericNumber = parseInt(number, 10);
        if (!number || Number.isNaN(numericNumber) || numericNumber < 1 || numericNumber > MAX_NUMBER) {
            alert(`1から${MAX_NUMBER}までの番号を入力してください。`);
            return;
        }

        const availableRange = getDivisionAudioRange(division);
        const localAudioSrc = getDivisionAudioSource(division, numericNumber);

        if (!localAudioSrc) {
            const message = availableRange
                ? `${DIVISION_LABELS[division]}は${availableRange.min}〜${availableRange.max}番まで登録されています。`
                : `${DIVISION_LABELS[division]}の音声はまだ登録されていません。`;
            alert(message);
            addLog({
                number,
                division,
                status: 'error',
                message: `再生エラー: ${message}`
            });
            return;
        }

        const audioSrc = localAudioSrc;

        const newAnnouncement = `番号 ${parseInt(number, 10)}番 ${DIVISION_LABELS[division]}`;
        setAnnouncement(newAnnouncement);
        setLastCall({ number, division });

        audio.play(audioSrc);

        addLog({
            number: number,
            division: division,
            status: 'success',
            message: `再生開始: ${newAnnouncement}`
        });

        setHistory(prev => {
            const newHistory = [number, ...prev.filter(n => n !== number)];
            return newHistory.slice(0, MAX_HISTORY);
        });

        if (division === Division.Exam) {
            setTimeout(() => {
                navigate('/record', { state: { autoStart: true, fromCall: true } });
            }, 400);
        }
        setNumber('');
    }, [number, audio, addLog, setHistory, navigate]);

    const handleStaffCall = useCallback(() => {
        const audioSrc = getStaffCallAudioSource();
        const announcementMessage = STAFF_CALL_ANNOUNCEMENT;

        setAnnouncement(announcementMessage);
        setLastCall({ number: STAFF_CALL_NUMBER, division: Division.Staff });

        audio.play(audioSrc);

        addLog({
            number: STAFF_CALL_NUMBER,
            division: Division.Staff,
            status: 'success',
            message: `再生開始: ${announcementMessage}`
        });
    }, [audio, addLog]);

    const handleRepeat = useCallback(() => {
        if (!lastCall) return;
        if (lastCall.division === Division.Staff) {
            handleStaffCall();
            return;
        }
        handlePlay(lastCall.division);
    }, [lastCall, handlePlay, handleStaffCall]);

    const handleNumpad = (key: string) => {
        if (key === 'C') {
            setNumber('');
        } else if (key === 'Backspace') {
            setNumber(n => n.slice(0, -1));
        } else if (/\d/.test(key) && number.length < 3) {
            setNumber(n => n + key);
        }
        mainInputRef.current?.focus();
    };

    const handleHistoryClick = (num: string) => {
        setNumber(num);
        mainInputRef.current?.focus();
    }

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            if (e.key === "Enter" && document.activeElement === mainInputRef.current) {
                e.preventDefault();
                if (lastCall?.division) {
                    if (lastCall.division === Division.Staff) {
                        handleStaffCall();
                    } else {
                        handlePlay(lastCall.division);
                    }
                } else {
                    handlePlay(Division.Exam); // Default to exam room if no last call
                }
            }
            return;
        }

        e.preventDefault();
        if (e.key >= '0' && e.key <= '9') {
            handleNumpad(e.key);
        } else if (e.key === 'Backspace') {
            handleNumpad('Backspace');
        } else if (e.key === 'Escape') {
            audio.stop();
        } else if (e.key === 'F1') {
            handlePlay(Division.Reception);
        } else if (e.key === 'F2') {
            handlePlay(Division.Exam);
        } else if (e.key === 'F3') {
            handlePlay(Division.Procedure);
        } else if (e.key === 'F4') {
            handleStaffCall();
        } else if (e.key === 'Enter') {
            if (lastCall?.division) {
                if (lastCall.division === Division.Staff) {
                    handleStaffCall();
                } else {
                    handlePlay(lastCall.division);
                }
            }
        }
    }, [handlePlay, handleStaffCall, audio, lastCall]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const DivisionButton: React.FC<{ division: Division, shortcut: string }> = ({ division, shortcut }) => (
        <button
            onClick={() => handlePlay(division)}
            disabled={!number}
            className="flex flex-col items-center justify-center text-xl font-bold rounded-xl shadow-md transition-all duration-150 h-24 md:h-32 disabled:opacity-40 disabled:cursor-not-allowed bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 active:scale-95 disabled:bg-slate-400"
        >
            {DIVISION_LABELS[division]}
            <span className="text-sm font-normal mt-1 opacity-80">({shortcut})</span>
        </button>
    );

    return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-2 md:px-4 py-6">
            <div className="w-full max-w-5xl mx-auto bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl p-5 md:p-8 space-y-6">

                <header className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">フロア呼び出し</p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">患者呼び出しシステム</h1>
                    </div>
                    <span className="text-sm text-slate-500">F1〜F4キー対応</span>
                </header>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-inner">
                    <div className="text-sm font-semibold text-slate-700">録音モデル</div>
                    <div className="flex gap-2">
                        {[AIProvider.OPENAI, AIProvider.GEMINI].map((p) => (
                            <button
                                key={p}
                                onClick={() => setSelectedProvider(p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                                    selectedProvider === p
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-[0_8px_18px_rgba(13,148,136,0.2)]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {p === AIProvider.OPENAI ? 'OpenAI (推奨)' : 'Gemini'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="flex flex-col space-y-3">
                        <div className="relative">
                            <input
                                ref={mainInputRef}
                                type="number"
                                value={number}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.length <= 3 && parseInt(val, 10) <= MAX_NUMBER || val === '') {
                                        setNumber(val);
                                    }
                                }}
                                placeholder="番号入力"
                                className="w-full text-5xl font-mono text-center p-4 rounded-xl bg-white border-2 border-slate-200 shadow-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none transition"
                            />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner">
                            <Numpad onKeyPress={handleNumpad} />
                        </div>
                    </div>

                    <div className="flex flex-col space-y-3">
                        <h2 className="text-sm font-semibold text-center text-slate-500 uppercase tracking-[0.08em]">呼び出し先</h2>
                        <div className="grid grid-cols-1 gap-2">
                            <DivisionButton division={Division.Reception} shortcut="F1" />
                            <DivisionButton division={Division.Exam} shortcut="F2" />
                            <DivisionButton division={Division.Procedure} shortcut="F3" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-inner">
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">スタッフ呼び出し</p>
                        <button
                            onClick={handleStaffCall}
                            disabled={audio.isPlaying}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-bold rounded-xl shadow-lg transition-all duration-150 bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            スタッフを呼び出す
                            <span className="text-sm font-normal opacity-80">(F4)</span>
                        </button>
                        <p className="text-xs text-center text-slate-600">音声が再生されている間は自動で停止するまで待機します。</p>
                    </div>
                </div>

                {history.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.1em]">入力履歴</h3>
                        <div className="flex flex-wrap gap-2">
                            {history.map(h => (
                                <button
                                    key={h}
                                    onClick={() => handleHistoryClick(h)}
                                    className="px-3 py-1 text-sm font-mono bg-slate-100 text-slate-700 border border-slate-200 rounded-full hover:bg-sky-100 hover:border-sky-200 transition-colors"
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <StatusDisplay announcement={audio.isPlaying ? announcement : null} error={audio.error} currentTime={audio.currentTime} duration={audio.duration} />

                <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                        onClick={handleRepeat}
                        disabled={!lastCall || audio.isPlaying}
                        className="flex items-center justify-center p-3 text-lg font-semibold rounded-lg shadow-md transition-all duration-150 bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RepeatIcon /> もう一度
                    </button>
                    <button
                        onClick={audio.stop}
                        disabled={!audio.isPlaying}
                        className="flex items-center justify-center p-3 text-lg font-semibold rounded-lg shadow-md transition-all duration-150 bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <StopIcon /> 停止
                    </button>
                </div>

                <div className="flex items-center space-x-3">
                    <SpeakerIcon />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => {
                            const newVolume = parseFloat(e.target.value);
                            setVolume(newVolume);
                            audio.setVolume(newVolume);
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <span className="text-sm font-mono w-12 text-center text-slate-700">{(volume * 100).toFixed(0)}%</span>
                </div>

                <LogViewer logs={logs} onClear={() => setLogs([])} />
            </div>
        </div>
    );
}
