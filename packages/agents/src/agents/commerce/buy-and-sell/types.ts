/**
 * Buy & Sell Agent Types
 */

export interface BuyAndSellContext {
  phone?: string;
  location?: { lat: number; lng: number };
  flowType?: 'selling' | 'buying' | 'inquiry' | 'category_selection';
  flowStep?: string;
  collectedData?: Record<string, unknown>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface BuyAndSellResult {
  message: string;
  action?: string;
  data?: Record<string, unknown>;
  nextStep?: string;
  flowComplete?: boolean;
}
