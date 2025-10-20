import WebSocket from "ws";
import { settings } from "./config";
import { logger } from "./logger";

export class OpenAIRealtimeClient {
  private socket?: WebSocket;
  private onAudioDeltaCallbacks: Array<(audioBase64: string) => void> = [];

  constructor(private readonly conversationId: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(settings.openai.realtimeUrl, {
        headers: {
          Authorization: `Bearer ${settings.openai.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
          "x-conversation-id": this.conversationId,
        },
      });
      ws.on("open", () => {
        logger.debug({ msg: "openai.connected", conversationId: this.conversationId });
        this.socket = ws;
        resolve();
      });
      ws.on("error", (error) => {
        logger.error({ msg: "openai.error", error });
        reject(error);
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          // Expect messages like: { type: "response.output_audio.delta", audio: "...base64..." }
          if (msg?.type === "response.output_audio.delta" && typeof msg.audio === "string") {
            for (const cb of this.onAudioDeltaCallbacks) cb(msg.audio);
          }
        } catch (err) {
          logger.warn({ msg: "openai.msg.parse_failed", error: err });
        }
      });
    });
  }

  initializeSession(sessionConfig: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: "session.update",
      session: sessionConfig,
    };
    this.socket.send(JSON.stringify(payload));
  }

  sendText(text: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: "input_text",
      text,
      timestamp: Date.now(),
    };
    this.socket.send(JSON.stringify(payload));
    // Request a response generation immediately for text inputs
    this.socket.send(JSON.stringify({ type: "response.create" }));
  }

  sendAudio(buffer: Buffer) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: "input_audio_buffer.append",
      audio: buffer.toString("base64"),
      timestamp: Date.now(),
    };
    this.socket.send(JSON.stringify(payload));
  }

  commitAudioAndRequestResponse() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    this.socket.send(JSON.stringify({ type: "response.create" }));
  }

  onOutputAudioDelta(cb: (audioBase64: string) => void) {
    this.onAudioDeltaCallbacks.push(cb);
  }

  close() {
    this.socket?.close();
  }
}
