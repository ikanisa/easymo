
import { describe, it, expect } from 'vitest';
import { WaiterAgent } from './packages/agents/src/agents/waiter/waiter.agent';
import { FarmerAgent } from './packages/agents/src/agents/farmer/farmer.agent';
import { BusinessBrokerAgent } from './packages/agents/src/agents/general/business-broker.agent';
import { RealEstateAgent } from './packages/agents/src/agents/property/real-estate.agent';
import { JobsAgent } from './packages/agents/src/agents/jobs/jobs.agent';
import { SalesAgent } from './packages/agents/src/agents/sales/sales.agent';

describe('Agent Verification', () => {
  const agents = [
    new WaiterAgent(),
    new FarmerAgent(),
    new BusinessBrokerAgent(),
    new RealEstateAgent(),
    new JobsAgent(),
    new SalesAgent()
  ];

  agents.forEach(agent => {
    it(`should verify ${agent.name}`, async () => {
      console.log(`\nVerifying ${agent.name}...`);
      expect(agent.instructions).toBeDefined();
      expect(agent.instructions.length).toBeGreaterThan(0);
      expect(agent.tools).toBeDefined();
      expect(agent.tools.length).toBeGreaterThan(0);

      try {
        const result = await agent.execute({
            userId: 'test-user',
            query: 'Hello',
            context: { userId: 'test-user' }
        });
        expect(result.success).toBe(true);
      } catch (e) {
        console.error(`Error executing ${agent.name}:`, e);
        throw e;
      }
    });
  });
});
