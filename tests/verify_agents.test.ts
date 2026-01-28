
import { describe, expect,it } from 'vitest';

import { BuyAndSellAgent } from '../packages/agents/src/agents/commerce/buy-and-sell.agent';

/**
 * Agent Verification Tests - Rwanda-Only
 * 
 * After refactoring, only BuyAndSellAgent remains active.
 * Deprecated agents removed: WaiterAgent, FarmerAgent, JobsAgent, 
 * RealEstateAgent, SalesAgent, BusinessBrokerAgent
 */
describe('Agent Verification', () => {
  const agents = [
    new BuyAndSellAgent()
  ];

  agents.forEach(agent => {
    it(`should verify ${agent.name}`, async () => {
      console.log(`\nVerifying ${agent.name}...`);
      expect(agent.instructions).toBeDefined();
      expect(agent.instructions.length).toBeGreaterThan(0);
      expect(agent.tools).toBeDefined();
      expect(agent.tools.length).toBeGreaterThan(0);

      try {
        const context: any = { userId: 'test-user' };

        const result = await agent.execute({
            userId: 'test-user',
            query: 'I need to find a hardware store',
            context
        });
        expect(result.success).toBe(true);
      } catch (e) {
        console.error(`Error executing ${agent.name}:`, e);
        throw e;
      }
    });
  });
});
