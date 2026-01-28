/**
 * Buy & Sell Agent - Main Export
 * 
 * Single source of truth for Buy & Sell AI agent.
 * 
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */

export * from './config';
export * from './prompts/system-prompt';
export * from './tools';
export * from './types';

// Note: The main BuyAndSellAgent class is exported from the parent directory
// to maintain backward compatibility with existing imports
export { BuyAndSellAgent, MarketplaceAgent, runBuyAndSellAgent } from '../buy-and-sell.agent';
