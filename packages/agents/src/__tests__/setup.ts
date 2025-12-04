/**
 * Test setup file for agents package
 * Configures mocks and globals for all tests
 */

import { vi } from 'vitest';

// Mock environment variables - set before any imports
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
  } as Response)
);
