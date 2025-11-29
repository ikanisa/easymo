/**
 * Domain-Specific AI Agents
 * Specialized agents for EasyMO business domains
 */

export { MarketplaceAgent, marketplaceAgent } from './marketplace-agent';
export { MobilityAgent, mobilityAgent } from './mobility-agent';
export { SupportAgent, supportAgent } from './support-agent';

export const DOMAIN_AGENTS = {
  mobility: 'mobility-agent',
  marketplace: 'marketplace-agent',
  support: 'support-agent',
} as const;

export type DomainAgentType = typeof DOMAIN_AGENTS[keyof typeof DOMAIN_AGENTS];
