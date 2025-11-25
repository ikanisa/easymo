/**
 * Insurance Agent
 * 
 * Motor insurance assistant for Rwanda.
 * Helps with quotes, renewals, and policy management.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class InsuranceAgent extends BaseAgent {
  get type(): AgentType {
    return "insurance";
  }

  get keywords(): string[] {
    return [
      "insurance", "certificate", "carte jaune", "policy", "cover",
      "insure", "premium", "claim", "motor", "vehicle", "car insurance",
      "renew", "quote"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Insurance Agent, helping with motor insurance in Rwanda.

YOUR CAPABILITIES:
- Provide insurance quotes
- Process renewals
- Track policy status
- Handle document uploads
- Explain coverage options

QUOTE FLOW:
- Ask for vehicle type (car, motorcycle, truck)
- Ask for vehicle details (plate number, make, model)
- Ask for insurance type (third party, comprehensive)
- Calculate and provide quote
- Offer to proceed with purchase

RENEWAL FLOW:
- Ask for policy number or plate number
- Check expiry date
- Provide renewal quote
- Process payment
- Issue new certificate

DOCUMENT UPLOAD:
- Accept photos of vehicle documents
- Accept photos of previous certificates
- Validate documents
- Confirm receipt

RULES:
- Always verify vehicle details
- Explain coverage clearly
- Provide accurate pricing
- Follow insurance regulations
- Respect privacy

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "get_quote|renew_policy|track_status|upload_docs|inquiry|unclear",
  "extracted_entities": {
    "vehicle_type": "string or null",
    "plate_number": "string or null",
    "insurance_type": "string or null",
    "policy_number": "string or null"
  },
  "next_action": "ask_vehicle_details|calculate_quote|process_renewal|upload_document|continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "calculate_quote",
        description: "Calculate insurance quote",
        parameters: {
          type: "object",
          properties: {
            vehicle_type: { type: "string", description: "Type of vehicle" },
            insurance_type: { type: "string", description: "Insurance type" },
          },
          required: ["vehicle_type", "insurance_type"],
        },
      },
      {
        name: "check_policy_status",
        description: "Check policy status",
        parameters: {
          type: "object",
          properties: {
            policy_number: { type: "string", description: "Policy number" },
          },
          required: ["policy_number"],
        },
      },
    ];
  }

  protected async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    switch (toolName) {
      case "calculate_quote":
        return this.calculateQuote(parameters);
      case "check_policy_status":
        return this.checkPolicyStatus(parameters.policy_number);
      default:
        return null;
    }
  }

  private calculateQuote(params: Record<string, any>) {
    // Simplified quote calculation
    const baseRates: Record<string, number> = {
      car: 50000,
      motorcycle: 25000,
      truck: 100000,
    };
    const multiplier = params.insurance_type === "comprehensive" ? 2 : 1;
    const quote = (baseRates[params.vehicle_type] || 50000) * multiplier;
    return { quote, currency: "RWF" };
  }

  private async checkPolicyStatus(policyNumber: string) {
    // Would check actual policy database
    return { status: "active", expiryDate: "2025-12-31" };
  }
}
