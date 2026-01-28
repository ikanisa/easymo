/**
 * Gemini Voice Bridge - Gemini Live API Integration
 * 
 * Manages a Live API session for voice calls, bridging raw audio from
 * telephony providers (like Meta WhatsApp) to Gemini.
 * 
 * Uses: gemini-2.5-flash-native-audio-preview-09-2025
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";

import { logStructuredEvent } from "../observability.ts";

declare const Deno: any;

const getEnv = (key: string) => {
  if (typeof Deno !== "undefined") return Deno.env.get(key);
  // @ts-ignore
  return typeof process !== "undefined" ? process.env[key] : undefined;
};

const API_KEY = getEnv("API_KEY") || getEnv("GEMINI_API_KEY");

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is required for voice bridge");
}

/**
 * Manages a Live API session for a voice call.
 * This bridges raw audio from a telephony provider (like Meta WhatsApp) to Gemini.
 */
export class GeminiVoiceBridge {
  private ai: GoogleGenerativeAI;
  private session: any;
  private onAudioOutput: (base64Pcm: string) => void;
  private onTranscript: (text: string, isUser: boolean) => void;
  private correlationId?: string;

  constructor(
    onAudioOutput: (base64Pcm: string) => void,
    onTranscript: (text: string, isUser: boolean) => void,
    correlationId?: string
  ) {
    this.ai = new GoogleGenerativeAI({ apiKey: API_KEY });
    this.onAudioOutput = onAudioOutput;
    this.onTranscript = onTranscript;
    this.correlationId = correlationId;
  }

  async connect(systemInstruction: string) {
    try {
      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            logStructuredEvent("GEMINI_LIVE_SESSION_OPENED", {
              correlationId: this.correlationId,
            });
          },
          onmessage: async (message: any) => {
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const audioData = message.serverContent.modelTurn.parts[0].inlineData.data;
              this.onAudioOutput(audioData);
            }
            
            // Handle input transcription (user speech)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              this.onTranscript(text, true);
              
              logStructuredEvent("GEMINI_LIVE_INPUT_TRANSCRIPT", {
                text: text.substring(0, 100), // Log first 100 chars
                correlationId: this.correlationId,
              });
            }
            
            // Handle output transcription (model speech)
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              this.onTranscript(text, false);
              
              logStructuredEvent("GEMINI_LIVE_OUTPUT_TRANSCRIPT", {
                text: text.substring(0, 100), // Log first 100 chars
                correlationId: this.correlationId,
              });
            }
          },
          onerror: (e: any) => {
            logStructuredEvent("GEMINI_LIVE_ERROR", {
              error: e?.message || String(e),
              correlationId: this.correlationId,
            }, "error");
          },
          onclose: (e: any) => {
            logStructuredEvent("GEMINI_LIVE_SESSION_CLOSED", {
              reason: e?.reason || "unknown",
              correlationId: this.correlationId,
            });
          },
        },
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
            },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
    } catch (error) {
      logStructuredEvent("GEMINI_LIVE_CONNECT_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.correlationId,
      }, "error");
      throw error;
    }
  }

  sendAudio(base64Pcm: string) {
    if (this.session) {
      try {
        this.session.sendRealtimeInput({
          media: {
            data: base64Pcm,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } catch (error) {
        logStructuredEvent("GEMINI_LIVE_SEND_AUDIO_ERROR", {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        }, "error");
      }
    }
  }

  async close() {
    if (this.session) {
      try {
        await this.session.close();
      } catch (error) {
        logStructuredEvent("GEMINI_LIVE_CLOSE_ERROR", {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        }, "error");
      }
    }
  }
}

/**
 * Decodes base64 string to Uint8Array (standard implementation)
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes Uint8Array to base64 string (standard implementation)
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Transcribe audio using Gemini 2.5 Flash Native Audio
 * For WhatsApp voice notes (not live calls)
 */
export async function transcribeVoiceNote(
  audioBuffer: Uint8Array,
  mimeType: string,
  correlationId?: string
): Promise<string | null> {
  try {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const ai = new GoogleGenerativeAI({ apiKey: API_KEY });
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash-native-audio-preview-09-2025' 
    });

    // Convert audio buffer to base64
    const audioBase64 = encodeBase64(audioBuffer);

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text: "Transcribe this audio message accurately. Only return the transcribed text, nothing else."
          },
          {
            inlineData: {
              mimeType,
              data: audioBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    });

    const text = result.response.text();
    
    if (text) {
      logStructuredEvent("VOICE_NOTE_TRANSCRIBED", {
        textLength: text.length,
        correlationId,
      });
      return text;
    }

    return null;
  } catch (error) {
    logStructuredEvent("VOICE_NOTE_TRANSCRIPTION_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return null;
  }
}

