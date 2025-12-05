/**
 * Business Broker Agent
 * 
 * @deprecated This agent has been merged into BuyAndSellAgent.
 * Use BuyAndSellAgent from '@easymo/agents' instead.
 * 
 * This file is kept for backward compatibility and re-exports the BuyAndSellAgent.
 */

import { BuyAndSellAgent, runBuyAndSellAgent } from '../commerce/buy-and-sell.agent';
import type { AgentInput, AgentResult } from '../../types/agent.types';

/**
 * @deprecated Use BuyAndSellAgent instead. BusinessBrokerAgent has been merged into BuyAndSellAgent.
 */
export class BusinessBrokerAgent extends BuyAndSellAgent {
  name = 'business_broker_agent';
  
  constructor() {
    super();
    console.warn(
      'DEPRECATION WARNING: BusinessBrokerAgent is deprecated. Use BuyAndSellAgent instead. ' +
      'BusinessBrokerAgent functionality has been merged into BuyAndSellAgent.'
    );
  }
}

/**
 * @deprecated Use runBuyAndSellAgent instead. This function wraps the BuyAndSellAgent.
 */
export async function runBusinessBrokerAgent(input: AgentInput): Promise<AgentResult> {
  console.warn(
    'DEPRECATION WARNING: runBusinessBrokerAgent is deprecated. Use runBuyAndSellAgent instead.'
  );
  return runBuyAndSellAgent(input);
}
