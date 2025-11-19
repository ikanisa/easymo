import { config } from "./config";

export type RouteInput = {
  topic?: string;
  to: string;
};

export type RouteDecision = {
  agentProfile: string;
  sipTarget: string;
  consentRequired: boolean;
};

const FARMER_KEYWORDS = [/farmer/i, /mazao/i, /produce/i, /mkulima/i, /shamba/i];

export function resolveRoute(input: RouteInput): RouteDecision {
  const topic = input.topic ?? "";
  if (
    (topic && FARMER_KEYWORDS.some((rx) => rx.test(topic))) ||
    FARMER_KEYWORDS.some((rx) => rx.test(input.to))
  ) {
    return {
      agentProfile: config.FARMER_AGENT_PROFILE,
      sipTarget: config.FARMER_SIP_TARGET,
      consentRequired: true,
    };
  }

  return {
    agentProfile: "general_agent",
    sipTarget: config.DEFAULT_SIP_TARGET,
    consentRequired: false,
  };
}
