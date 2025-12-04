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
        this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
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

    private handleMessage(event: MessageEvent) {
        try {
            let data;
            if (event.data instanceof Blob) {
                // Handle binary data if necessary (usually response audio)
                // For now we expect JSON text for transcription/SOAP
                // But the API might send Blob for audio
                console.log("Received Blob message, ignoring for now");
                return;
            } else {
                data = JSON.parse(event.data);
            }

            // console.log('Received Message:', data);

            if (data.serverContent) {
                const content = data.serverContent;

                if (content.modelTurn) {
                    const parts = content.modelTurn.parts;
                    if (parts) {
                        for (const part of parts) {
                            if (part.text) {
                                this.emit('content', part.text);
                            }
                        }
                    }
                }

                if (content.turnComplete) {
                    this.emit('turnComplete');
                }
            }

            if (data.toolCall) {
                // Handle tool calls if we add them later
            }

        } catch (e) {
            console.error('Error parsing message:', e);
        }
    }
}
