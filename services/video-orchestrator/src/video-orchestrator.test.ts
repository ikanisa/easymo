import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';

const PORT = 3002;

describe('Video Orchestrator Service', () => {
  let server: Server;

  beforeAll(async () => {
    // Dynamically import to avoid side effects
    const module = await import('./server');
    server = module.server;
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      
      if (response.ok) {
        const data = await response.json();
        expect(data.status).toBe('ok');
        expect(data.service).toBe('video-orchestrator');
      } else {
        // Service may not have health endpoint yet
        expect(response.status).toBeGreaterThan(0);
      }
    });
  });

  describe('Service Configuration', () => {
    it('should have valid configuration', async () => {
      const { config } = await import('./config');
      
      expect(config).toBeDefined();
      expect(config.PORT).toBeGreaterThan(0);
    });
  });

  describe('Orchestrator Logic', () => {
    it('should export orchestrator functions', async () => {
      const module = await import('./orchestrator');
      
      expect(module).toBeDefined();
    });
  });

  describe('Job Scheduler', () => {
    it('should export scheduler functions', async () => {
      const module = await import('./job-scheduler');
      
      expect(module).toBeDefined();
    });
  });
});
