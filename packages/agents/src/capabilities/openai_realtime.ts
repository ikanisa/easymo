import { WebSocket } from "ws";

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  instructions?: string;
  voice?: "alloy" | "echo" | "shimmer";
}

export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private url = "wss://api.openai.com/v1/realtime";

  constructor(config: RealtimeConfig) {
    this.config = config;
  }

  async connect() {
    const model = this.config.model || "gpt-4o-realtime-preview-2024-10-01";
    const url = `${this.url}?model=${model}`;
    
    this.ws = new WebSocket(url, {
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject("WebSocket not initialized");

      this.ws.on("open", () => {
        console.log("Connected to OpenAI Realtime API");
        this.initializeSession();
        resolve(true);
      });

      this.ws.on("message", (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on("error", (error) => {
        console.error("Realtime API Error:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log("Disconnected from OpenAI Realtime API");
      });
    });
  }

  private initializeSession() {
    if (!this.ws) return;
    
    const event = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: this.config.instructions || "You are a helpful assistant.",
        voice: this.config.voice || "alloy",
      },
    };
    
    this.ws.send(JSON.stringify(event));
  }

  private handleMessage(event: any) {
    switch (event.type) {
      case "response.audio.delta":
        // Handle incoming audio stream (e.g., send to SIP trunk)
        // console.log("Received audio delta");
        break;
      case "response.text.delta":
        // Handle text stream
        break;
      case "response.done":
        console.log("Response complete");
        break;
      default:
        // console.log("Received event:", event.type);
    }
  }

  sendAudio(audioChunk: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const event = {
      type: "input_audio_buffer.append",
      audio: audioChunk,
    };
    this.ws.send(JSON.stringify(event));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
