
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Globe, AlertCircle, Volume2, Play, FileText, Save, X, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Visualizer from '../components/Visualizer';
import Loader from '../components/Loader';
import { AppMode, PatientInfo, ChatMessage, ChatRole, MedicalRecord, AIProvider } from '../types';
import { generateClinicalNote } from '../services/aiService';
import { translateText } from '../services/geminiService';
import { saveRecord } from '../services/storageService';
import { useApiKey } from '../contexts/ApiKeyContext';
import ApiKeyModal from '../components/ApiKeyModal';
import FileUploadModal from '../components/FileUploadModal';
import { useRecordingStatus } from '../contexts/RecordingContext';

const getProviderLabel = (provider: AIProvider) => {
  return provider === AIProvider.OPENAI ? 'OpenAI (Whisper + GPT-5-mini)' : 'Gemini 2.5 Flash';
};

const buildApiErrorMessage = (error: any, provider: AIProvider) => {
  const providerLabel = provider === AIProvider.OPENAI ? 'OpenAI API' : 'Gemini API';
  const detail = error?.message || '';

  let message = `${providerLabel}との通信に失敗しました。`;

  if (detail.includes("400")) {
    message += " (リクエスト不正: ファイル形式や長さの問題の可能性があります)";
  } else if (detail.includes("401") || detail.includes("API Key")) {
    message += " (APIキーが無効です)";
  } else if (detail.includes("429") || error?.status === 429) {
    message += provider === AIProvider.OPENAI
      ? " (OpenAIの利用制限/残高不足の可能性があります)"
      : " (利用制限を超過しました)";
  } else if (detail.includes("500") || detail.includes("503") || error?.status === 500 || error?.status === 503) {
    message += " (サーバーエラー: しばらく待ってから再試行してください)";
  } else {
    message += " APIキーやネットワーク接続を確認してください。";
  }

  return message;
};

const RecordPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiKeys } = useApiKey();
  const { setRecordingActive } = useRecordingStatus();

  // State
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [provider, setProvider] = useState<AIProvider>(AIProvider.GEMINI);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<AppMode>(AppMode.STANDARD);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [failedAudioBlob, setFailedAudioBlob] = useState<Blob | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Translation Mode State
  const [targetLang, setTargetLang] = useState('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRole, setActiveRole] = useState<ChatRole | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track speech recognition indices to prevent duplication
  const speechMapRef = useRef<Map<number, string>>(new Map());

  // Refs for main recording (SOAP generation)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Reset recording flag when leaving the page
  useEffect(() => {
    return () => setRecordingActive(false);
  }, [setRecordingActive]);

  // ----------------------------------------------------------------
  // Main Audio Recording Logic (SOAP Generation)
  // ----------------------------------------------------------------
  const startMainRecording = async () => {
    // Check if key exists for selected provider
    if (!apiKeys[provider]) {
      setShowApiKeyModal(true);
      return;
    }
    // Check dependency for non-Gemini
    if (provider !== AIProvider.GEMINI && !apiKeys[AIProvider.OPENAI]) {
      setError("このプロバイダーを使用するにはOpenAIキーも必要です（音声認識用）");
      setShowApiKeyModal(true);
      return;
    }

    try {
      setError(null);
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      // Optimize for speech: mono, lower bitrate (e.g., 32kbps is usually sufficient for speech)
      // Note: 'audio/webm;codecs=opus' is standard for Chrome/Firefox.
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000 // 32kbps
      };

      // Fallback if specific codec is not supported
      const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType)
        ? new MediaRecorder(audioStream, options)
        : new MediaRecorder(audioStream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // Request data every 1 second for safety
      setIsRecording(true);
      setRecordingActive(true);
      setShowReviewModal(false);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError("マイクにアクセスできませんでした。設定を確認してください。");
    }
  };

  const handleStopRequest = () => {
    // If in standard mode, stop and process immediately
    if (mode === AppMode.STANDARD) {
      stopAndProcessSoap();
    } else {
      // In translate mode, pause and show review modal
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      stopSpeechRecognition(); // Stop active listening
      setIsRecording(false); // Update UI state to "paused/stopped" look
      setRecordingActive(false);
      setShowReviewModal(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecording(true);
      setRecordingActive(true);
      setShowReviewModal(false);
    }
  };

  // Helper: Download audio file
  const downloadAudioFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stopAndProcessSoap = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setRecordingActive(false);
      setShowReviewModal(false);

      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      stopSpeechRecognition();

      // Process audio after a short delay
      setTimeout(() => {
        processAudio();
      }, 500);
    }
  }, [stream, setRecordingActive]);

  const processAudio = async () => {
    setIsProcessing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];

        try {
          // Validate keys again just in case
          if (!apiKeys[provider]) throw new Error(`${provider} API Key is missing`);

          const result = await generateClinicalNote(base64String, mode, provider, apiKeys);
          const patientInfo: PatientInfo = { id: patientId, name: patientName };
          navigate('/result', { state: { result, patientInfo } });
        } catch (apiError: any) {
          console.error(`${getProviderLabel(provider)} Error Details:`, apiError);
          const errorMessage = buildApiErrorMessage(apiError, provider);

          // Save blob for potential download
          setFailedAudioBlob(blob);
          setError(errorMessage);
          setIsProcessing(false);
        }
      };
    } catch (err) {
      setError("音声データの処理中にエラーが発生しました。");
      setIsProcessing(false);
    }
  };

  // Process uploaded audio file
  const processUploadedFile = async (file: File) => {
    if (!apiKeys[provider]) {
      setShowApiKeyModal(true);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];

        // Determine MIME type
        let mimeType = 'audio/webm';
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        if (fileType.includes('mp3') || fileName.endsWith('.mp3')) {
          mimeType = 'audio/mpeg';
        } else if (fileType.includes('mp4') || fileName.endsWith('.mp4') || fileName.endsWith('.m4a')) {
          mimeType = 'audio/mp4';
        } else if (fileType.includes('webm') || fileName.endsWith('.webm')) {
          mimeType = 'audio/webm';
        }

        try {
          const result = await generateClinicalNote(base64String, mode, provider, apiKeys, mimeType);
          const patientInfo: PatientInfo = { id: patientId, name: patientName };
          navigate('/result', { state: { result, patientInfo } });
        } catch (apiError: any) {
          console.error(`${getProviderLabel(provider)} Error Details:`, apiError);
          const errorMessage = buildApiErrorMessage(apiError, provider);

          setError(errorMessage);
          setIsProcessing(false);
        }
      };
    } catch (err) {
      setError("ファイルの処理中にエラーが発生しました。");
      setIsProcessing(false);
    }
  };

  const handleSaveLogOnly = () => {
    // Create a record based ONLY on chat messages, skipping Gemini SOAP generation
    const transcript = messages.map(msg => ({
      speaker: msg.role === ChatRole.DOCTOR ? '医師' : '患者',
      text: msg.translatedText
        ? `${msg.originalText} (${msg.translatedText})`
        : msg.originalText
    }));

    const record: MedicalRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      patient: { id: patientId, name: patientName },
      data: {
        language: targetLang,
        transcription: transcript,
        soap: { s: '', o: '', a: '', p: '' } // Empty SOAP
      }
    };

    saveRecord(record);

    // Cleanup
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    navigate('/history');
  };

  // ----------------------------------------------------------------
  // Web Speech API & Translation Logic
  // ----------------------------------------------------------------
  const startSpeechRecognition = (role: ChatRole) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError("お使いのブラウザは音声認識に対応していません。Google Chromeを使用してください。");
      return;
    }

    // Stop previous instance if any to ensure fast switching
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Language Mapping for Web Speech API
    const langCodeMap: Record<string, string> = {
      'en': 'en-US',
      'zh': 'zh-CN',
      'ko': 'ko-KR',
      'vi': 'vi-VN',
      'ne': 'ne-NP',
      'tl': 'fil-PH', // Tagalog
      'id': 'id-ID',
      'th': 'th-TH',
      'pt': 'pt-BR',
      'es': 'es-ES',
      'my': 'my-MM'
    };

    recognition.lang = role === ChatRole.DOCTOR ? 'ja-JP' : (langCodeMap[targetLang] || 'en-US');
    recognition.continuous = true;
    recognition.interimResults = true;

    // Clear the result map for the new session
    speechMapRef.current.clear();

    recognition.onstart = () => {
      setActiveRole(role);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error", event.error);
      if (event.error !== 'aborted') {
        if (event.error === 'not-allowed') {
          setError("マイクの使用が許可されていません。");
        }
        // Only clear active role if this instance is still current
        if (recognitionRef.current === recognition) {
          setActiveRole(null);
        }
      }
    };

    recognition.onend = () => {
      // Only clear active role if this instance is still current
      if (recognitionRef.current === recognition) {
        setActiveRole(null);
      }
    };

    recognition.onresult = async (event: any) => {
      // Loop through results from the event
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        // Retrieve stable ID from map, or create new one
        let msgId = speechMapRef.current.get(i);

        if (!msgId) {
          msgId = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
          speechMapRef.current.set(i, msgId);

          setMessages(prev => [...prev, {
            id: msgId!,
            role,
            originalText: transcript,
            timestamp: Date.now(),
            isFinal
          }]);
        } else {
          setMessages(prev => prev.map(m => m.id === msgId ? {
            ...m,
            originalText: transcript,
            isFinal
          } : m));
        }

        // Translate only on final result
        if (isFinal) {
          const capturedId = msgId;
          const translateTo = role === ChatRole.DOCTOR ? targetLang : 'ja';
          // Use Gemini key for translation if available, or any available key?
          // translateText uses Gemini 2.5 Flash internally, so it needs Gemini Key.
          // We should probably fallback or warn if Gemini key is missing but others are present.
          // For now, let's use apiKeys[AIProvider.GEMINI]
          const geminiKey = apiKeys[AIProvider.GEMINI];
          if (geminiKey) {
            translateText(transcript, translateTo, geminiKey).then(translated => {
              setMessages(prev => prev.map(m => m.id === capturedId ? { ...m, translatedText: translated } : m));
            });
          }
        }
      }
    };

    recognitionRef.current = recognition; // Set ref before start
    try {
      recognition.start();
      setActiveRole(role); // Optimistic UI update
    } catch (e) {
      console.error("Failed to start recognition", e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setActiveRole(null);
  };

  const toggleRoleMic = (role: ChatRole) => {
    // For translation, we need Gemini key ideally, or at least some key.
    // But translation service is hardcoded to Gemini.
    if (!apiKeys[AIProvider.GEMINI]) {
      // Warn or allow but no translation?
      // Let's prompt for key
      setShowApiKeyModal(true);
      return;
    }

    if (activeRole === role) {
      stopSpeechRecognition();
    } else {
      // Immediately switch to the new role (internally stops previous one)
      startSpeechRecognition(role);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  if (isProcessing) {
    const loaderText = provider === AIProvider.OPENAI
      ? 'OpenAI (Whisper + GPT-5-mini) が音声を解析中... SOAPを作成しています'
      : 'Gemini 2.5 Flashが音声を解析中... SOAPを作成しています';

    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader text={loaderText} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-6 space-y-6 h-[calc(100vh-80px)] flex flex-col relative">

      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${isRecording ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className={`h-3 w-3 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse shadow-[0_0_0_6px_rgba(244,63,94,0.2)]' : 'bg-slate-300 shadow-inner'}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {isRecording ? '録音中 - 診察が終わったら停止してください' : '録音待機中 - 診察開始時に録音を押してください'}
          </p>
          <p className="text-xs text-slate-500">
            {isRecording ? '停止するとSOAP生成に進みます' : '録音を開始するとこのバーが赤く変わります'}
          </p>
        </div>
        {!isRecording && (
          <button
            onClick={startMainRecording}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold shadow hover:bg-emerald-600"
          >
            録音開始
          </button>
        )}
      </div>

      {/* Top Controls (Patient Info & Mode) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-2 flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block">氏名</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="患者氏名"
              className="w-full p-1.5 bg-gray-50 border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 text-sm"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500 block">ID</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="ID"
              className="w-full p-1.5 bg-gray-50 border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setMode(AppMode.STANDARD)}
            disabled={isRecording}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === AppMode.STANDARD ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
              } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            通常 (JP)
          </button>
          <button
            onClick={() => setMode(AppMode.TRANSLATE)}
            disabled={isRecording}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === AppMode.TRANSLATE ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            翻訳 (Multi)
          </button>
        </div>

        {/* Provider Selector */}
        <div className="md:col-span-3 flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
          <span className="text-xs font-bold text-gray-500 px-2">AI Model:</span>
          <div className="flex-1 flex gap-2 overflow-x-auto">
            {Object.values(AIProvider).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                disabled={isRecording}
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${provider === p
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {p === AIProvider.GEMINI && 'Gemini 2.5 Flash'}
                {p === AIProvider.OPENAI && 'GPT-5-mini'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Translate Mode Layout */}
      {mode === AppMode.TRANSLATE ? (
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden relative">
          {/* Language Selector Header */}
          <div className="bg-indigo-50 p-3 flex justify-between items-center border-b border-indigo-100">
            <div className="flex items-center gap-2 text-indigo-800 font-bold text-sm">
              <Globe size={16} />
              リアルタイム通訳モード
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">相手の言語:</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="text-sm border-gray-300 rounded-md p-1 focus:ring-indigo-500"
                disabled={isRecording}
              >
                <option value="en">English (英語)</option>
                <option value="zh">Chinese (中国語)</option>
                <option value="ko">Korean (韓国語)</option>
                <option value="vi">Vietnamese (ベトナム語)</option>
                <option value="ne">Nepali (ネパール語)</option>
                <option value="tl">Filipino/Tagalog (タガログ語)</option>
                <option value="id">Indonesian (インドネシア語)</option>
                <option value="th">Thai (タイ語)</option>
                <option value="pt">Portuguese (ポルトガル語)</option>
                <option value="es">Spanish (スペイン語)</option>
                <option value="my">Burmese (ミャンマー語)</option>
              </select>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-10 text-sm">
                <p>会話を開始してください。</p>
                <p className="text-xs mt-2">録音開始後、話す人のボタンをタップして切り替えてください。</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === ChatRole.DOCTOR ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 shadow-sm ${msg.role === ChatRole.DOCTOR
                  ? 'bg-teal-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                  }`}>
                  <div className="text-xs font-bold mb-1 opacity-80">
                    {msg.role === ChatRole.DOCTOR ? '医師 (JP)' : `患者 (${targetLang.toUpperCase()})`}
                  </div>
                  <div className="text-base">
                    {msg.originalText}
                  </div>
                  {msg.translatedText && (
                    <div className={`mt-2 pt-2 border-t text-sm ${msg.role === ChatRole.DOCTOR ? 'border-teal-500 text-teal-50' : 'border-gray-100 text-indigo-600'}`}>
                      {msg.translatedText}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Interaction Footer (Translate Mode) */}
          <div className="p-4 bg-white border-t border-gray-200">
            {!isRecording && !showReviewModal ? (
              <button
                onClick={startMainRecording}
                className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Mic size={20} />
                診察を開始する (録音ON)
              </button>
            ) : (
              <div className={`flex gap-4 ${showReviewModal ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Doctor Mic */}
                <button
                  onClick={() => toggleRoleMic(ChatRole.DOCTOR)}
                  className={`flex-1 py-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 ${activeRole === ChatRole.DOCTOR
                    ? 'bg-teal-600 border-teal-500 text-white ring-4 ring-teal-200 scale-105 shadow-xl'
                    : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 hover:opacity-100'
                    }`}
                >
                  <Mic size={32} className={activeRole === ChatRole.DOCTOR ? 'animate-bounce' : ''} />
                  <span className="font-bold text-lg">医師 (日本語)</span>
                  <span className="text-xs font-mono uppercase tracking-widest">
                    {activeRole === ChatRole.DOCTOR ? 'Listening...' : 'TAP TO SPEAK'}
                  </span>
                </button>

                {/* Stop Button */}
                <div className="flex flex-col items-center justify-center gap-2 w-20">
                  <button
                    onClick={handleStopRequest}
                    className="w-16 h-16 rounded-full bg-white border-4 border-red-500 text-red-500 flex items-center justify-center hover:bg-red-50 hover:scale-105 shadow-lg transition"
                    title="一時停止 / 終了"
                  >
                    <Square size={24} fill="currentColor" />
                  </button>
                </div>

                {/* Patient Mic */}
                <button
                  onClick={() => toggleRoleMic(ChatRole.PATIENT)}
                  className={`flex-1 py-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 ${activeRole === ChatRole.PATIENT
                    ? 'bg-indigo-600 border-indigo-500 text-white ring-4 ring-indigo-200 scale-105 shadow-xl'
                    : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 hover:opacity-100'
                    }`}
                >
                  <Mic size={32} className={activeRole === ChatRole.PATIENT ? 'animate-bounce' : ''} />
                  <span className="font-bold text-lg">患者 ({targetLang.toUpperCase()})</span>
                  <span className="text-xs font-mono uppercase tracking-widest">
                    {activeRole === ChatRole.PATIENT ? 'Listening...' : 'TAP TO SPEAK'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Standard Mode Layout (Simplified Big Button)
        <div className="flex-1 bg-white rounded-xl shadow-md border border-gray-200 p-8 flex flex-col items-center justify-center space-y-8">
          <div className="relative group">
            {isRecording && (
              <span className="absolute top-0 right-0 -mt-2 -mr-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
              </span>
            )}

            <button
              onClick={isRecording ? handleStopRequest : startMainRecording}
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${isRecording
                ? 'bg-red-50 text-red-600 border-4 border-red-500 hover:bg-red-100 hover:scale-105'
                : 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-teal-500/30 hover:scale-105'
                }`}
            >
              {isRecording ? <Square size={48} fill="currentColor" /> : <Mic size={64} />}
            </button>
          </div>

          <div className="w-full max-w-md text-center space-y-4">
            <p className="text-gray-500 text-lg font-medium mb-4">
              {isRecording ? "録音中... 診療を行ってください" : "ボタンを押して診療を開始"}
            </p>
            <Visualizer stream={stream} isRecording={isRecording} />

            {!isRecording && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition flex items-center justify-center gap-2 mx-auto"
                >
                  <Upload size={20} />
                  ファイルをアップロード
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  事前に録音した音声ファイルを文字起こし
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review / Action Modal for Translate Mode */}
      {showReviewModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">診療を終了しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">
              録音を一時停止しました。次のアクションを選択してください。
            </p>

            <div className="space-y-3">
              <button
                onClick={stopAndProcessSoap}
                className="w-full py-3 px-4 bg-teal-600 text-white rounded-lg font-bold shadow hover:bg-teal-700 flex items-center justify-center gap-2"
              >
                <FileText size={18} />
                SOAPを作成して終了
              </button>

              <button
                onClick={handleSaveLogOnly}
                className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Save size={18} />
                ログのみ保存して終了
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">または</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                onClick={resumeRecording}
                className="w-full py-3 px-4 bg-indigo-100 text-indigo-700 rounded-lg font-bold hover:bg-indigo-200 flex items-center justify-center gap-2"
              >
                <Play size={18} />
                会話を再開する
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200 text-sm shadow-sm absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
          {failedAudioBlob && (
            <button
              onClick={() => {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                downloadAudioFile(failedAudioBlob, `recording_${timestamp}.webm`);
              }}
              className="mt-2 px-3 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              <Save size={16} />
              録音をダウンロード
            </button>
          )}
        </div>
      )}

      {!showReviewModal && (
        <div className="text-center text-xs text-gray-400">
          Powered by {getProviderLabel(provider)} & Web Speech API
        </div>
      )}

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        forceOpen={true}
      />

      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onFileSelected={processUploadedFile}
      />
    </div>
  );
};

export default RecordPage;
