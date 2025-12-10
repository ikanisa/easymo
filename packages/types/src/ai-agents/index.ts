/**
 * AI Agents Type Exports
 * Single source of truth for all AI agent type definitions
 * 
 * @packageDocumentation
 */

// Core agent types
export type {
  AgentWithRelations,
  AiAgent,
  AiAgentIntent,
  AiAgentKnowledgeBase,
  AiAgentMatchEvent,
  AiAgentPersona,
  AiAgentsOverview,
  AiAgentSystemInstruction,
  AiAgentTask,
  AiAgentTool,
  Channel,
  ConversationStatus,
  CreateAiAgentInput,
  CreateAiAgentIntentInput,
  CreateAiAgentKnowledgeBaseInput,
  CreateAiAgentMatchEventInput,
  CreateAiAgentPersonaInput,
  CreateAiAgentTaskInput,
  CreateAiAgentToolInput,
  IntentStatus,
  MatchType,
  MessageDirection,
  MessageType,
  StorageType,
  ToolType,
  UpdateAiAgentInput,
  UpdateAiAgentIntentInput,
  UpdateAiAgentKnowledgeBaseInput,
  UpdateAiAgentPersonaInput,
  UpdateAiAgentTaskInput,
  UpdateAiAgentToolInput,
} from './core.types.js';

// Vertical and agent type enums
export type {
  AgentSlug,
  AgentType,
  EasyMOVertical,
  IntentAnalysis,
  VerticalMapping,
} from './verticals.types.js';
export { AGENT_SLUGS } from './verticals.types.js';

// Ecosystem types (WhatsApp, Rides, Insurance)
export type {
  ApplyIntentResult,
  ConversationWithRelations,
  CreateWhatsappConversationInput,
  CreateWhatsappMessageInput,
  CreateWhatsappUserInput,
  InsuranceDocument,
  InsuranceDocumentType,
  InsuranceProfile,
  InsuranceQuoteRequest,
  InsuranceQuoteStatus,
  InsuranceRequestType,
  InsuranceUserRequest,
  IntentApplicationResult,
  RidesDriverStatus,
  RidesNearbyDriver,
  RidesNearbyPassenger,
  RidesSavedLocation,
  RidesTrip,
  TripStatus,
  UpdateWhatsappConversationInput,
  UpdateWhatsappMessageInput,
  UpdateWhatsappUserInput,
  WhatsappConversation,
  WhatsappMessage,
  WhatsappUser,
} from './ecosystem.types.js';
export {
  CONVERSATION_STATUSES,
  INTENT_STATUSES,
  MESSAGE_DIRECTIONS,
} from './ecosystem.types.js';

// Database types
export type {
  AiAgentIntentRow,
  AiAgentKnowledgeBaseRow,
  AiAgentMatchEventRow,
  AiAgentPersonaRow,
  AiAgentRow,
  AiAgentsOverviewRow,
  AiAgentSystemInstructionRow,
  AiAgentTaskRow,
  AiAgentToolRow,
  Database,
  InsuranceDocumentRow,
  InsuranceProfileRow,
  InsuranceQuoteRequestRow,
  RidesDriverStatusRow,
  RidesSavedLocationRow,
  RidesTripRow,
  WhatsappConversationRow,
  WhatsappMessageRow,
  WhatsappUserRow,
} from './database.types.js';
export { dbToTs } from './database.types.js';
