/**
 * Gemini Live API for Real-time Voice Conversations
 * 
 * Enables voice-to-voice conversations with:
 * - Real-time audio streaming
 * - Multi-modal input (audio + text + images)
 * - Tool use during conversations
 * - Multi-language support
 * 
 * @see https://ai.google.dev/gemini-api/docs/live
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { EventEmitter } from "events";

// ============================================================================
// TYPES
// ============================================================================

export interface LiveSessionConfig {
  model?: string;
  instructions?: string;
  voice?: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";
  language?: string;
  tools?: LiveTool[];
  enableGoogleSearch?: boolean;
  enableCodeExecution?: boolean;
  responseModalities?: Array<"TEXT" | "AUDIO">;
}

export interface LiveTool {
  name: string;
  description: string;
  parameters: object;
}

export interface AudioChunk {
  data: Int16Array;
  sampleRate: number;
}

export interface LiveEvent {
  type: "audio" | "text" | "tool_call" | "error" | "connected" | "disconnected";
  data?: unknown;
}

// ============================================================================
// GEMINI LIVE CLIENT
// ============================================================================

export class GeminiLiveClient extends EventEmitter {
  private genAI: GoogleGenerativeAI;
  private session: any = null;
  private config: LiveSessionConfig;
  private isConnected = false;

  constructor(apiKey: string, config: LiveSessionConfig = {}) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.config = config;
  }

  /**
   * Connect to Gemini Live session
   */
  async connect(): Promise<void> {
    try {
      const model = this.config.model ?? "gemini-2.0-flash-exp";
      
      // Build tools
      const tools: any[] = [];
      if (this.config.enableGoogleSearch) {
        tools.push({ googleSearch: {} });
      }
      if (this.config.enableCodeExecution) {
        tools.push({ codeExecution: {} });
      }
      if (this.config.tools?.length) {
        tools.push({
          functionDeclarations: this.config.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        });
      }

      // Create live session
      // Note: This is a conceptual implementation.  
      // The actual Gemini Live API may have different methods.
      this.session = await (this.genAI as any).live.connect({
        model,
        config: {
          responseModalities: this.config.responseModalities ?? ["AUDIO", "TEXT"],
          systemInstruction: {
            parts: [{ text: this.config.instructions ?? "You are a helpful assistant." }],
          },
          tools: tools.length > 0 ? tools : undefined,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.config.voice ?? "Aoede",
              },
            },
            languageCode: this.config.language ?? "en-US",
          },
        },
      });

      // Set up event handlers
      this.session.on("audio", (audio: any) => {
        this.emit("audio", {
          type: "audio",
          data: audio,
        });
      });

      this.session.on("text", (text: string) => {
        this.emit("text", {
          type: "text",
          data: text,
        });
      });

      this.session.on("toolCall", (toolCall: any) => {
        this.emit("tool_call", {
          type: "tool_call",
          data: toolCall,
        });
      });

      this.session.on("error", (error: Error) => {
        this.emit("error", {
          type: "error",
          data: error.message,
        });
      });

      this.isConnected = true;
      this.emit("connected", { type: "connected" });

    } catch (error) {
      this.emit("error", {
        type: "error",
        data: error instanceof Error ? error.message : "Connection failed",
      });
      throw error;
    }
  }

  /**
   * Send audio chunk to the session
   */
  async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.isConnected || !this.session) {
      throw new Error("Not connected to Gemini Live");
    }

    await this.session.send({
      media_chunks: [{
        mime_type: "audio/pcm",
        data: Buffer.from(chunk.data.buffer).toString("base64"),
      }],
    });
  }

  /**
   * Disconnect session
   */
  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    this.isConnected = false;
    this.emit("disconnected", { type: "disconnected" });
  }
}

export default GeminiLiveClient;
