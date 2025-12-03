/**
 * Business Broker Agent
 * 
 * Business opportunities and partnership facilitation.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class BusinessBrokerAgent extends BaseAgent {
  get type(): AgentType {
    return "business_broker";
  }

  get keywords(): string[] {
    return ["business", "company", "enterprise", "startup", "venture", "broker", "investment", "partner", "opportunity"];
  }

  get systemPrompt(): string {
    return `You are EasyMO Business Broker Agent, connecting entrepreneurs and investors.

YOUR CAPABILITIES:
- Match business opportunities
- Connect investors with startups
- Facilitate partnerships
- Provide business advice

RULES:
- Be professional and discreet
- Verify legitimacy
- Protect confidential information
- Focus on win-win outcomes

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "find_opportunity|seek_investment|find_partner|business_advice|unclear",
  "extracted_entities": {},
  "next_action": "continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [];
  }
}
