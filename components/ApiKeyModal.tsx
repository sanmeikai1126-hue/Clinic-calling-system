import React, { useState, useEffect } from 'react';
import { Key, Save, X, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { AIProvider } from '../types';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    forceOpen?: boolean; // If true, cannot be closed without at least one key (usually Gemini)
}

const PROVIDER_CONFIG = {
    [AIProvider.GEMINI]: {
        label: 'Google Gemini',
        placeholder: 'AIzaSy...',
        link: 'https://aistudio.google.com/app/apikey',
        description: 'マルチモーダル対応 (推奨)'
    },
    [AIProvider.OPENAI]: {
        label: 'OpenAI',
        placeholder: 'sk-...',
        link: 'https://platform.openai.com/api-keys',
        description: 'Whisper + GPT-5-mini'
    }
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, forceOpen = false }) => {
    const { apiKeys, saveApiKey, isKeySet } = useApiKey();
    const [localKeys, setLocalKeys] = useState<Record<string, string>>({});
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocalKeys({
                [AIProvider.GEMINI]: apiKeys[AIProvider.GEMINI] || '',
                [AIProvider.OPENAI]: apiKeys[AIProvider.OPENAI] || '',
            });
        }
    }, [isOpen, apiKeys]);

    if (!isOpen) return null;

    const handleSave = () => {
        let hasError = false;

        // Basic validation: At least one key should be present if forced? 
        // Or specifically Gemini if it's the default?
        // For now, let's just save what we have.

        Object.entries(localKeys).forEach(([provider, key]) => {
            const typedKey = key as string;
            if (typedKey.trim()) {
                saveApiKey(provider as AIProvider, typedKey.trim());
            }
        });

        // If forceOpen is true, we might want to ensure at least one key is set.
        // But the user might be switching providers.
        // Let's assume if they click save, they mean it.

        setError('');
        onClose();
    };

    const handleClose = () => {
        if (forceOpen && !isKeySet) {
            setError('少なくとも1つのAPIキーを設定してください (Gemini推奨)');
            return;
        }
        onClose();
    };

    const toggleShowKey = (provider: string) => {
        setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Key size={24} />
                            APIキー設定
                        </h2>
                        <p className="text-teal-100 text-sm mt-1">
                            各AIプロバイダーのAPIキーを設定してください
                        </p>
                    </div>
                    {!forceOpen && (
                        <button onClick={handleClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">

                    {Object.values(AIProvider).map((provider) => (
                        <div key={provider} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-gray-700">
                                    {PROVIDER_CONFIG[provider].label}
                                </label>
                                <a
                                    href={PROVIDER_CONFIG[provider].link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                                >
                                    取得 <ExternalLink size={10} />
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showKey[provider] ? "text" : "password"}
                                    value={localKeys[provider] || ''}
                                    onChange={(e) => {
                                        setLocalKeys(prev => ({ ...prev, [provider]: e.target.value }));
                                        setError('');
                                    }}
                                    placeholder={PROVIDER_CONFIG[provider].placeholder}
                                    className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleShowKey(provider)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showKey[provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                {PROVIDER_CONFIG[provider].description}
                            </p>
                        </div>
                    ))}

                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-800">
                        <p className="font-bold mb-1">注意:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>キーはブラウザ内にのみ保存され、外部サーバーには送信されません。</li>
                            <li>Gemini: ネイティブ音声処理 / OpenAI: Whisper + GPT-4o</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-teal-600 text-white rounded-lg font-bold shadow-lg hover:bg-teal-700 transition flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        保存して閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
