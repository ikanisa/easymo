/**
 * Buy & Sell Agent - Admin App Re-export
 * 
 * This file provides backward compatibility by re-exporting from the
 * consolidated Buy & Sell agent in @easymo/agents.
 * 
 * @deprecated Import directly from '@easymo/agents/commerce' instead.
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */

// Re-export consolidated agent
export { 
  BuyAndSellAgent, 
  MarketplaceAgent as MarketplaceAgentDeprecated,
  runBuyAndSellAgent 
} from '@easymo/agents';

// Backward compatibility: MarketplaceAgent is now an alias for BuyAndSellAgent
import { BuyAndSellAgent } from '@easymo/agents';

/**
 * @deprecated Use BuyAndSellAgent instead. MarketplaceAgent has been merged into BuyAndSellAgent.
 */
export class MarketplaceAgent extends BuyAndSellAgent {
  constructor() {
    super();
    console.warn(
      'DEPRECATION WARNING: MarketplaceAgent is deprecated. Use BuyAndSellAgent instead.'
    );
  }
}

// Singleton instances for convenience
export const buyAndSellAgent = new BuyAndSellAgent();

/**
 * @deprecated Use buyAndSellAgent instead
 */
export const marketplaceAgent = buyAndSellAgent;
