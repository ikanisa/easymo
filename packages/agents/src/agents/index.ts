/**
 * Agent Registry
 * 
 * Central registry of all official agents.
 */

// Base
export { BaseAgent } from './base/agent.base';

// Domain Agents
export { FarmerAgent } from './farmer/farmer.agent';
export { JobsAgent } from './jobs/jobs.agent';
export { RealEstateAgent } from './property/real-estate.agent';
export { SalesAgent } from './sales/sales.agent';
export { WaiterAgent } from './waiter/waiter.agent';

// Consolidated Buy & Sell Agent (replaces marketplace and business_broker)
export { BuyAndSellAgent, runBuyAndSellAgent } from './commerce/buy-and-sell.agent';

// Legacy exports - deprecated, use BuyAndSellAgent instead
export { BusinessBrokerAgent, runBusinessBrokerAgent } from './general/business-broker.agent';
