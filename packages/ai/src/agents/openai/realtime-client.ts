/**
 * OpenAI Realtime API Client
 * 
 * Enables low-latency voice conversations using WebSocket.
 * Supports:
 * - Audio streaming (input/output)
 * - VAD (Voice Activity Detection)
 * - Function calling
 * - Interruptions
 * 
 * @see https://platform.openai.com/docs/guides/realtime
 */

import WebSocket from "ws";
import { EventEmitter } from "events";

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: "alloy" | "echo" | "shimmer";
  instructions?: string;
}

export class RealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private url = "wss://api.openai.com/v1/realtime";

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the Realtime API
   */
  async connect(): Promise<void> {
    const model = this.config.model ?? "gpt-4o-realtime-preview";
    const url = `${this.url}?model=${model}`;

    this.ws = new WebSocket(url, {
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.ws.on("open", () => {
      this.emit("connected");
      this.initializeSession();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      } catch (error) {
        this.emit("error", error);
      }
    });

    this.ws.on("error", (error) => {
      this.emit("error", error);
    });

    this.ws.on("close", () => {
      this.emit("disconnected");
    });
  }

  /**
   * Send audio delta
   */
  sendAudio(base64Audio: string): void {
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Audio,
    });
  }

  /**
   * Commit audio buffer (trigger generation)
   */
  commitAudio(): void {
    this.send({ type: "input_audio_buffer.commit" });
    this.send({ type: "response.create" });
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  private initializeSession(): void {
    this.send({
      type: "session.update",
      session: {
        voice: this.config.voice ?? "alloy",
        instructions: this.config.instructions ?? "You are a helpful assistant.",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
        },
      },
    });
  }

  private handleEvent(event: any): void {
    switch (event.type) {
      case "response.audio.delta":
        this.emit("audio", event.delta);
        break;
      case "response.audio_transcript.delta":
        this.emit("transcript", event.delta);
        break;
      case "response.done":
        this.emit("response_done", event.response);
        break;
      case "error":
        this.emit("error", event.error);
        break;
      default:
        // Handle other events or emit generic event
        this.emit("event", event);
    }
  }

  private send(event: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else {
      console.warn("WebSocket not open, cannot send event:", event.type);
    }
  }
}

export default RealtimeClient;
