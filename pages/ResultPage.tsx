import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GeminiResponse, PatientInfo, MedicalRecord } from '../types';
import { saveRecord } from '../services/storageService';
import { Save, Copy, Check, ArrowLeft, FileDown } from 'lucide-react';

interface LocationState {
  result: GeminiResponse;
  patientInfo: PatientInfo;
}

const ResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  // Local state for editing
  const [transcription, setTranscription] = useState(state?.result?.transcription || []);
  const [soap, setSoap] = useState(state?.result?.soap || { s: '', o: '', a: '', p: '' });
  const [patientInfo, setPatientInfo] = useState<PatientInfo>(state?.patientInfo || { id: '', name: '' });
  const [isSaved, setIsSaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!state) {
      navigate('/');
    }
  }, [state, navigate]);

  if (!state) return null;

  const handleSave = () => {
    const record: MedicalRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      patient: patientInfo,
      data: {
        ...state.result,
        transcription,
        soap
      }
    };
    saveRecord(record);
    setIsSaved(true);
    setTimeout(() => navigate('/history'), 1000);
  };

  const copySoapToClipboard = () => {
    const text = `(S)\n${soap.s}\n\n(O)\n${soap.o}\n\n(A)\n${soap.a}\n\n(P)\n${soap.p}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Download functionality
  const handleDownloadTxt = () => {
    const dateStr = new Date().toLocaleDateString('ja-JP').replace(/\//g, '-');
    const filename = `medical_record_${patientInfo.id || 'no_id'}_${dateStr}.txt`;

    const content = [
      "【診療記録】",
      `日時: ${new Date().toLocaleString('ja-JP')}`,
      `患者ID: ${patientInfo.id}`,
      `氏名: ${patientInfo.name}`,
      "",
      "【SOAP】",
      `(S) ${soap.s}`,
      `(O) ${soap.o}`,
      `(A) ${soap.a}`,
      `(P) ${soap.p}`,
      "",
      "【文字起こし】",
      ...transcription.map(t => `[${t.speaker}] ${t.text}`)
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTranscriptChange = (index: number, newText: string) => {
    const newItems = [...transcription];
    newItems[index].text = newText;
    setTranscription(newItems);
  };

  return (
    <div className="max-w-6xl mx-auto w-full h-[calc(100vh-120px)] bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="bg-white/95 border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">結果確認・編集</h2>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={patientInfo.name}
                onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
                placeholder="氏名 (未登録)"
                className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 w-32"
              />
              <input
                type="text"
                value={patientInfo.id}
                onChange={(e) => setPatientInfo({ ...patientInfo, id: e.target.value })}
                placeholder="ID"
                className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 w-24"
              />
              {state.result.usedModel && (
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  {state.result.usedModel}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadTxt}
            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
            title="テキストファイルとしてダウンロード"
          >
            <FileDown size={16} />
            テキスト出力
          </button>
          <button
            onClick={copySoapToClipboard}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition"
          >
            {copySuccess ? <Check size={16} /> : <Copy size={16} />}
            {copySuccess ? "コピーしました" : "SOAPコピー"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition ${isSaved ? 'bg-green-600' : 'bg-teal-600 hover:bg-teal-700'
              }`}
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? "保存完了" : "完了 (保存)"}
          </button>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gradient-to-br from-slate-50 via-white to-slate-50">

        {/* Left: Transcript */}
        <div className="w-full md:w-1/2 flex flex-col border-r border-slate-200 bg-slate-50/80">
          <div className="p-3 bg-slate-100 border-b border-slate-200 text-sm font-semibold text-slate-700 uppercase tracking-wider">
            文字起こし (Transcript)
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcription.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <span className={`text-xs font-bold ${item.speaker === '医師' ? 'text-teal-700' : 'text-orange-700'}`}>
                  [{item.speaker}]
                </span>
                <textarea
                  value={item.text}
                  onChange={(e) => handleTranscriptChange(idx, e.target.value)}
                  className="w-full p-2 bg-white border border-gray-200 rounded text-sm text-gray-700 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  rows={Math.max(2, Math.ceil(item.text.length / 40))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: SOAP */}
        <div className="w-full md:w-1/2 flex flex-col bg-white">
          <div className="p-3 bg-slate-100 border-b border-slate-200 text-sm font-semibold text-slate-700 uppercase tracking-wider">
            SOAP ノート
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* S */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <span className="bg-teal-100 px-2 py-0.5 rounded text-sm">(S) Subjective</span>
              </div>
              <textarea
                value={soap.s}
                onChange={(e) => setSoap({ ...soap, s: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                rows={4}
              />
            </div>

            {/* O */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <span className="bg-teal-100 px-2 py-0.5 rounded text-sm">(O) Objective</span>
              </div>
              <textarea
                value={soap.o}
                onChange={(e) => setSoap({ ...soap, o: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                rows={4}
              />
            </div>

            {/* A */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <span className="bg-teal-100 px-2 py-0.5 rounded text-sm">(A) Assessment</span>
              </div>
              <textarea
                value={soap.a}
                onChange={(e) => setSoap({ ...soap, a: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                rows={2}
              />
            </div>

            {/* P */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <span className="bg-teal-100 px-2 py-0.5 rounded text-sm">(P) Plan</span>
              </div>
              <textarea
                value={soap.p}
                onChange={(e) => setSoap({ ...soap, p: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-800 leading-relaxed focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                rows={4}
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ResultPage;
