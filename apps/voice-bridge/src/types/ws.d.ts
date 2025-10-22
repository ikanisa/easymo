declare module 'ws' {
  export type RawData = { toString(encoding?: string): string };

  export default class WebSocket {
    constructor(url: string, options?: any);
    send(data: any): void;
    close(): void;
    once(event: string, listener: (...args: any[]) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export class WebSocketServer {
    constructor(options: any);
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
