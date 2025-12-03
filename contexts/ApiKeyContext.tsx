import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AIProvider } from '../types';

type ApiKeys = {
    [key in AIProvider]?: string;
};

interface ApiKeyContextType {
    apiKeys: ApiKeys;
    saveApiKey: (provider: AIProvider, key: string) => void;
    clearApiKey: (provider: AIProvider) => void;
    getApiKey: (provider: AIProvider) => string | null;
    // Legacy support for Gemini (returns Gemini key)
    apiKey: string | null;
    isKeySet: boolean; // True if Gemini key is set (legacy)
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [apiKeys, setApiKeys] = useState<ApiKeys>({});

    useEffect(() => {
        const keys: ApiKeys = {};
        // Load existing Gemini key
        const geminiKey = localStorage.getItem('gemini_api_key');
        if (geminiKey) keys[AIProvider.GEMINI] = geminiKey;

        // Load OpenAI key
        const openaiKey = localStorage.getItem('openai_api_key');
        if (openaiKey) keys[AIProvider.OPENAI] = openaiKey;

        setApiKeys(keys);
    }, []);

    const saveApiKey = (provider: AIProvider, key: string) => {
        const storageKey = `${provider.toLowerCase()}_api_key`;
        localStorage.setItem(storageKey, key);
        setApiKeys(prev => ({ ...prev, [provider]: key }));
    };

    const clearApiKey = (provider: AIProvider) => {
        const storageKey = `${provider.toLowerCase()}_api_key`;
        localStorage.removeItem(storageKey);
        setApiKeys(prev => {
            const newKeys = { ...prev };
            delete newKeys[provider];
            return newKeys;
        });
    };

    const getApiKey = (provider: AIProvider) => {
        return apiKeys[provider] || null;
    };

    return (
        <ApiKeyContext.Provider value={{
            apiKeys,
            saveApiKey,
            clearApiKey,
            getApiKey,
            apiKey: apiKeys[AIProvider.GEMINI] || null,
            isKeySet: !!apiKeys[AIProvider.GEMINI]
        }}>
            {children}
        </ApiKeyContext.Provider>
    );
};

export const useApiKey = (): ApiKeyContextType => {
    const context = useContext(ApiKeyContext);
    if (context === undefined) {
        throw new Error('useApiKey must be used within an ApiKeyProvider');
    }
    return context;
};
