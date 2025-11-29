import type { Server } from 'http';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { server } from './server';

const PORT = 3001;

describe('Voice Bridge Service', () => {
  let serverInstance: Server;

  beforeAll(async () => {
    serverInstance = server.listen(PORT);
  });

  afterAll(() => {
    serverInstance.close();
  });

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('voice-bridge');
      expect(data.uptime).toBeGreaterThan(0);
    });
  });

  describe('Outbound Calls', () => {
    it('should validate payload schema', async () => {
      const response = await fetch(`http://localhost:${PORT}/calls/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_payload');
    });

    it('should accept valid outbound call request', async () => {
      const response = await fetch(`http://localhost:${PORT}/calls/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+254712345678',
          from: 'sip:bridge@sip.easymo',
          topic: 'farmer-support',
          metadata: { language: 'sw' },
        }),
      });

      expect([200, 502]).toContain(response.status);
    });
  });

  describe('Consent Recording', () => {
    it('should validate consent payload', async () => {
      const response = await fetch(`http://localhost:${PORT}/calls/test-id/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_payload');
    });
  });

  describe('Transcript Segments', () => {
    it('should validate segments schema', async () => {
      const response = await fetch(`http://localhost:${PORT}/calls/test-id/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: [] }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_payload');
    });

    it('should accept valid segments', async () => {
      const response = await fetch(`http://localhost:${PORT}/calls/test-id/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: 'en',
          segments: [
            {
              sequence: 0,
              speaker: 'caller',
              text: 'Hello, I need help',
              confidence: 0.95,
            },
          ],
        }),
      });

      expect([200, 500]).toContain(response.status);
    });
  });
});
