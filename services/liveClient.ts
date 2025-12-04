type EventHandler = (...args: any[]) => void;

class SimpleEventEmitter {
    private listeners: Record<string, EventHandler[]> = {};

    on(event: string, handler: EventHandler) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
    }

    emit(event: string, ...args: any[]) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(handler => handler(...args));
        }
    }

    off(event: string, handler: EventHandler) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(h => h !== handler);
        }
    }
}

export interface LiveConfig {
    model: string;
    systemInstruction?: string;
    generationConfig?: {
        responseModalities?: "text" | "audio" | "image";
        speechConfig?: {
            voiceConfig?: {
                prebuiltVoiceConfig?: {
                    voiceName: string;
                };
            };
        };
    };
}

export class MultimodalLiveClient extends SimpleEventEmitter {
    private ws: WebSocket | null = null;
    private url: string;

    constructor(apiKey: string) {
        super();
        this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    }

    connect(config: LiveConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('Gemini Live WebSocket Connected');
                    this.sendSetup(config);
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.ws.onerror = (error) => {
                    console.error('Gemini Live WebSocket Error:', error);
                    this.emit('error', error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('Gemini Live WebSocket Closed:', event.code, event.reason);
                    this.emit('close', event);
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    sendSetup(config: LiveConfig) {
        if (!this.ws) return;

        const setupMessage = {
            setup: {
                model: config.model,
                generationConfig: config.generationConfig,
                systemInstruction: config.systemInstruction ? {
                    parts: [{ text: config.systemInstruction }]
                } : undefined,
            }
        };

        console.log('Sending Setup:', setupMessage);
        this.ws.send(JSON.stringify(setupMessage));
    }

    sendAudioChunk(base64Audio: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const audioMessage = {
            realtimeInput: {
                mediaChunks: [
                    {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                    }
                ]
            }
        };

        this.ws.send(JSON.stringify(audioMessage));
    }

    sendText(text: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const textMessage = {
            clientContent: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: text }]
                    }
                ],
                turnComplete: true
            }
        };

        this.ws.send(JSON.stringify(textMessage));
    }

    private async handleMessage(event: MessageEvent) {
        try {
            let data;
            if (event.data instanceof Blob) {
                // Blob messages might contain server messages
                console.log('[Live API] Received Blob message, size:', event.data.size);

                // Try to read Blob as text to see if it contains JSON
                try {
                    const text = await event.data.text();
                    console.log('[Live API] Blob content (first 200 chars):', text.substring(0, 200));

                    // Try to parse as JSON
                    try {
                        data = JSON.parse(text);
                        console.log('[Live API] Blob contained JSON:', data);
                    } catch (e) {
                        // Not JSON, probably audio data
                        console.log('[Live API] Blob is binary/audio data, not JSON');
                        return;
                    }
                } catch (e) {
                    console.log('[Live API] Could not read Blob as text');
                    return;
                }
            } else {
                data = JSON.parse(event.data);
            }

            console.log('[Live API] Received JSON Message:', JSON.stringify(data, null, 2));

            if (data.setupComplete) {
                console.log('[Live API] Setup completed successfully');
            }

            if (data.serverContent) {
                console.log('[Live API] Server content received:', data.serverContent);
                const content = data.serverContent;

                if (content.modelTurn) {
                    console.log('[Live API] Model turn detected');
                    const parts = content.modelTurn.parts;
                    if (parts) {
                        for (const part of parts) {
                            if (part.text) {
                                console.log('[Live API] Emitting text content:', part.text);
                                this.emit('content', part.text);
                            }
                        }
                    }
                }

                if (content.turnComplete) {
                    console.log('[Live API] Turn complete');
                    this.emit('turnComplete');
                }
            }

            if (data.toolCall) {
                // Handle tool calls if we add them later
                console.log('[Live API] Tool call received (not implemented)');
            }

        } catch (e) {
            console.error('[Live API] Error parsing message:', e, 'Raw data:', event.data);
        }
    }
}
