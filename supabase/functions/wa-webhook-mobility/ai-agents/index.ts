/**
 * AI Agents Module
 *
 * Central export point for all AI agent functionality in the WhatsApp webhook system.
 * 
 * EasyMO Rwanda-only: Supports mobility (rides/transport) and schedule trip agents.
 */

export {
  type AgentRequest,
  type AgentResponse,
  checkAgentSessionStatus,
  handleAgentSelection,
  routeToAIAgent,
  sendAgentOptions,
} from "./integration.ts";

export {
  handleAIAgentLocationUpdate,
  handleAIAgentOptionSelection,
  handleAINearbyDrivers,
  handleAIScheduleTrip,
  handleShopFallbackSelection,
} from "./handlers.ts";
export type { ShopResultsState } from "./handlers.ts";
