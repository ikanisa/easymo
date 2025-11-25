/**
 * Sales Agent
 * 
 * Sales and customer management assistant.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class SalesAgent extends BaseAgent {
  get type(): AgentType {
    return "sales";
  }

  get keywords(): string[] {
    return ["sales", "sell", "selling", "customer", "client", "deal", "offer", "discount", "price", "quote", "proposal"];
  }

  get systemPrompt(): string {
    return `You are EasyMO Sales Agent, helping with sales and customer management.

YOUR CAPABILITIES:
- Track sales opportunities
- Manage customer relationships
- Create quotes and proposals
- Track deal pipeline
- Provide sales advice

RULES:
- Be professional and results-oriented
- Focus on customer needs
- Provide clear pricing
- Track all interactions

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "create_quote|track_deal|manage_customer|sales_advice|unclear",
  "extracted_entities": {},
  "next_action": "continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [];
  }
}
