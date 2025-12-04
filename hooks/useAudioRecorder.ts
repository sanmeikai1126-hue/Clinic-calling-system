import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderHook {
    isRecording: boolean;
    startRecording: (onData: (base64: string) => void) => Promise<void>;
    stopRecording: () => void;
    error: string | null;
}

export const useAudioRecorder = (): AudioRecorderHook => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const startRecording = useCallback(async (onData: (base64: string) => void) => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000, // Try to request 16kHz directly
            });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            inputRef.current = source;

            // Buffer size 4096 is a good balance between latency and performance
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const inputSampleRate = audioContext.sampleRate;
                const targetSampleRate = 16000;

                let pcmData: Int16Array;

                if (inputSampleRate === targetSampleRate) {
                    // No resampling needed
                    pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                } else {
                    // Simple downsampling (decimation)
                    // Note: This is a naive implementation. For better quality, use a proper resampling library or AudioWorklet.
                    // But for speech recognition, this might be "good enough" if the ratio is simple.
                    // A better approach is to use OfflineAudioContext for resampling, but that's not real-time.
                    // Let's try a simple linear interpolation or just skipping samples.

                    const ratio = inputSampleRate / targetSampleRate;
                    const newLength = Math.floor(inputData.length / ratio);
                    pcmData = new Int16Array(newLength);

                    for (let i = 0; i < newLength; i++) {
                        const offset = i * ratio;
                        const index = Math.floor(offset);
                        const nextIndex = Math.min(index + 1, inputData.length - 1);
                        const weight = offset - index;

                        // Linear interpolation
                        const val = inputData[index] * (1 - weight) + inputData[nextIndex] * weight;
                        const s = Math.max(-1, Math.min(1, val));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                }

                // Convert to Base64
                const buffer = new ArrayBuffer(pcmData.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcmData.length; i++) {
                    view.setInt16(i * 2, pcmData[i], true); // Little endian
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

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        setIsRecording(false);
        streamRef.current = null;
        audioContextRef.current = null;
        processorRef.current = null;
        inputRef.current = null;
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        error
    };
};
