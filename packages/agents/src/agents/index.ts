/**
 * Agent Registry
 * 
 * Central registry of all available agents.
 */

// Original agents
export { BookingAgent, runBookingAgent } from './booking';
export { analyzeIntent,runTriageAgent, TriageAgent } from './triage';

// New enhanced agents - ALL COMPLETE ✅
export { BaseAgent } from './base/agent.base';
export { FarmerAgent } from './farmer/farmer.agent';
export { JobsAgent } from './jobs/jobs.agent';
export { PharmacyAgent } from './pharmacy/pharmacy.agent';
export { RealEstateAgent } from './property/real-estate.agent';
export { SalesAgent } from './sales/sales.agent';
export { SupportAgent } from './support/support.agent';
export { WaiterAgent } from './waiter/waiter.agent';

// Consolidated Buy & Sell Agent (replaces marketplace and business_broker)
export { BuyAndSellAgent, runBuyAndSellAgent } from './commerce/buy-and-sell.agent';

// Legacy exports - deprecated, use BuyAndSellAgent instead
export { BusinessBrokerAgent, runBusinessBrokerAgent } from './general/business-broker.agent';
