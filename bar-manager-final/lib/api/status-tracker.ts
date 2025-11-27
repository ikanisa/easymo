/**
 * API Integration Status Tracker
 * Documents which endpoints are live vs. mock
 */
export const API_STATUS = {
  // ✅ Live APIs
  dashboard: { 
    status: 'live', 
    endpoint: '/api/dashboard',
    components: ['components/dashboard/']
  },
  insurance: { 
    status: 'live', 
    endpoint: '/api/insurance',
    components: ['app/insurance/', 'components/insurance/']
  },
  liveCalls: {
    status: 'live',
    endpoint: '/api/live-calls',
    components: ['components/live-calls/']
  },
  marketplace: {
    status: 'partial',
    endpoint: '/api/marketplace',
    components: ['components/marketplace/'],
    notes: 'Ranking/intents/purchases wired to Phase 4/5 services'
  },
  
  // ⚠️ Mock APIs (Priority to replace)
  users: { 
    status: 'mock', 
    endpoint: null,
    components: ['components/users/'],
    priority: 'HIGH'
  },
  analytics: {
    status: 'mock',
    endpoint: null,
    components: ['components/analytics/'],
    priority: 'HIGH'
  },
  
  // 🔄 Partial Integration
  voice: {
    status: 'partial',
    endpoint: process.env.VOICE_BRIDGE_API_URL,
    components: ['components/voice/'],
    notes: 'Wired to Phase 4/5 services'
  },
  leads: {
    status: 'partial',
    endpoint: process.env.AGENT_CORE_URL,
    components: ['components/agents/'],
    notes: 'Persists through Agent-Core'
  }
} as const;

// Health check for all services
export async function checkServiceHealth() {
  const services = [
    { name: 'Agent Core', url: process.env.AGENT_CORE_URL },
    { name: 'Voice Bridge', url: process.env.VOICE_BRIDGE_API_URL },
    { name: 'Wallet Service', url: process.env.WALLET_SERVICE_URL },
    { name: 'Insurance Service', url: process.env.INSURANCE_SERVICE_URL },
  ];
  
  const results = await Promise.allSettled(
    services.map(async (service) => {
      if (!service.url) return { ...service, healthy: false, error: 'URL not configured' };
      try {
        const response = await fetch(`${service.url}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        return { ...service, healthy: response.ok };
      } catch (error) {
        return { ...service, healthy: false, error: String(error) };
      }
    })
  );
  
  return results;
}
