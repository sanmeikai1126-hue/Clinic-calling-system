import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderHook {
    isRecording: boolean;
    startRecording: (onData: (base64: string) => void) => Promise<void>;
    stopRecording: () => void;
    error: string | null;
}

export const useAudioRecorder = (): AudioRecorderHook & { getAudioBlob: () => Promise<Blob | null> } => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioChunksRef = useRef<Int16Array[]>([]);

    const startRecording = useCallback(async (onData: (base64: string) => void) => {
        try {
            setError(null);
            audioChunksRef.current = []; // Reset chunks
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000,
            });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            inputRef.current = source;

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const inputSampleRate = audioContext.sampleRate;
                const targetSampleRate = 16000;

                let pcmData: Int16Array;

                if (inputSampleRate === targetSampleRate) {
                    pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                } else {
                    const ratio = inputSampleRate / targetSampleRate;
                    const newLength = Math.floor(inputData.length / ratio);
                    pcmData = new Int16Array(newLength);

                    for (let i = 0; i < newLength; i++) {
                        const offset = i * ratio;
                        const index = Math.floor(offset);
                        const nextIndex = Math.min(index + 1, inputData.length - 1);
                        const weight = offset - index;

                        const val = inputData[index] * (1 - weight) + inputData[nextIndex] * weight;
                        const s = Math.max(-1, Math.min(1, val));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                }

                // Store PCM data for Blob creation
                audioChunksRef.current.push(pcmData);

                // Convert to Base64 for Live API
                const buffer = new ArrayBuffer(pcmData.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcmData.length; i++) {
                    view.setInt16(i * 2, pcmData[i], true);
                }

                const base64 = btoa(
                    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );

                onData(base64);
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsRecording(true);
        } catch (err: any) {
            console.error('Error starting recording:', err);
            setError(err.message || 'Failed to start recording');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (processorRef.current && inputRef.current) {
            inputRef.current.disconnect();
            processorRef.current.disconnect();
        }

        // マイクは即座に確実に停止
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        // AudioContextは段階的にクローズして他のタブのオーディオへの干渉を防ぐ
        if (audioContextRef.current) {
            const ctx = audioContextRef.current;
            ctx.suspend().then(() => {
                // 1秒後にクローズ（Chromeのオーディオセッション安定のため）
                setTimeout(() => {
                    ctx.close().catch(() => { });
                }, 1000);
            }).catch(() => { });
        }

        setIsRecording(false);
        streamRef.current = null;
        audioContextRef.current = null;
        processorRef.current = null;
        inputRef.current = null;
    }, []);

    const getAudioBlob = useCallback(async (): Promise<Blob | null> => {
        if (audioChunksRef.current.length === 0) return null;

        // Calculate total length
        const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
        const wavBuffer = new ArrayBuffer(44 + totalLength * 2);
        const view = new DataView(wavBuffer);

        // WAV Header
        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + totalLength * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, 16000, true); // Sample Rate
        view.setUint32(28, 16000 * 2, true); // Byte Rate
        view.setUint16(32, 2, true); // Block Align
        view.setUint16(34, 16, true); // Bits per Sample
        writeString(view, 36, 'data');
        view.setUint32(40, totalLength * 2, true);

        // Write PCM data
        let offset = 44;
        for (const chunk of audioChunksRef.current) {
            for (let i = 0; i < chunk.length; i++) {
                view.setInt16(offset, chunk[i], true);
                offset += 2;
            }
        }

        return new Blob([wavBuffer], { type: 'audio/wav' });
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        getAudioBlob,
        error
    };
};
