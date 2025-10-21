import WebSocket from 'ws';
import { Writable } from 'stream';
import { env } from '../../../common/env';

export type RealtimeWsPeer = {
  ws: WebSocket;
  sendPcm: Writable;
  close: () => void;
};

export async function createRealtimeWsPeer(onPcmOut: (buffer: Buffer) => void): Promise<RealtimeWsPeer> {
  if (!env.realtimeWsUrl) {
    throw new Error('REALTIME_WS_URL not configured');
  }
  if (!env.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const ws = new WebSocket(env.realtimeWsUrl, {
    headers: { Authorization: `Bearer ${env.openaiApiKey}` },
  });

  ws.on('message', (data: WebSocket.RawData) => {
    if (Buffer.isBuffer(data)) {
      onPcmOut(data);
    }
  });

  const sendPcm = new Writable({
    write(chunk, _encoding, callback) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
      callback();
    },
  });

  return {
    ws,
    sendPcm,
    close: () => ws.close(),
  };
}
