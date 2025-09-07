/**
 * ULTRA-MINIMAL WhatsApp Mobility - Adapter Factory
 * Creates appropriate adapter based on environment
 */

import { useMock } from './env';
import { mockAdapter } from './adapter.mock';
import { RealAdapter } from './adapter.real';
import { getApiBase, getAdminToken } from './env';

// Global adapter instance - Phase 1 uses mock, Phase 2 will use real
export const ADAPTER = useMock() 
  ? mockAdapter 
  : new RealAdapter(getApiBase(), getAdminToken());