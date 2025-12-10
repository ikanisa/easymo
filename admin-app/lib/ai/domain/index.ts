/**
 * Domain-Specific AI Agents
 * Specialized agents for EasyMO business domains
 */

export { 
  BuyAndSellAgent,
  buyAndSellAgent,
  MarketplaceAgent, // Deprecated, use BuyAndSellAgent
  marketplaceAgent, // Deprecated, use buyAndSellAgent
} from './marketplace-agent';
export { SupportAgent, supportAgent } from './support-agent';

export const DOMAIN_AGENTS = {
  mobility: 'mobility-agent',
  buy_sell: 'buy-sell-agent',
  buy_and_sell: 'buy-sell-agent', // Deprecated alias (standardized to buy_sell)
  marketplace: 'buy-sell-agent', // Deprecated alias
  buy_and_sell: 'buy-and-sell-agent',
  marketplace: 'buy-and-sell-agent', // Deprecated alias
  support: 'support-agent',
} as const;

export type DomainAgentType = typeof DOMAIN_AGENTS[keyof typeof DOMAIN_AGENTS];
