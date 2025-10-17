/**
 * ULTRA-MINIMAL WhatsApp Mobility - Adapter Factory
 * Creates appropriate adapter based on environment
 */

import { shouldUseMock } from './env';
import { mockAdapter } from './adapter.mock';
import { RealAdapter } from './adapter.real';

// Global adapter instance - Phase 1 uses mock, Phase 2 will use real
export const ADAPTER = shouldUseMock()
  ? mockAdapter
  : new RealAdapter();
