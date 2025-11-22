// =====================================================================
// AI AGENT ECOSYSTEM – TYPESCRIPT TYPES
// =====================================================================
// Auto-generated types for AI Agent tables
// Maps snake_case DB columns to camelCase TypeScript
// =====================================================================

export interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  defaultPersonaCode: string | null;
  defaultSystemInstructionCode: string | null;
  defaultLanguage: string | null;
  defaultChannel: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentPersona {
  id: string;
  agentId: string;
  code: string | null;
  roleName: string | null;
  toneStyle: string | null;
  languages: string[] | null;
  traits: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentSystemInstruction {
  id: string;
  agentId: string;
  code: string | null;
  title: string | null;
  instructions: string | null;
  guardrails: string | null;
  memoryStrategy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentTool {
  id: string;
  agentId: string;
  name: string | null;
  displayName: string | null;
  toolType: string | null;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentTask {
  id: string;
  agentId: string;
  code: string | null;
  name: string | null;
  description: string | null;
  triggerDescription: string | null;
  toolsUsed: string[] | null;
  outputDescription: string | null;
  requiresHumanHandoff: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentKnowledgeBase {
  id: string;
  agentId: string;
  code: string | null;
  name: string | null;
  description: string | null;
  storageType: string | null;
  accessMethod: string | null;
  updateStrategy: string | null;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappUser {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  preferredLanguage: string | null;
  timezone: string | null;
  userRoles: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappConversation {
  id: string;
  userId: string;
  agentId: string;
  externalThreadId: string | null;
  context: string | null;
  status: string;
  lastMessageAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: string | null;
  waMessageId: string | null;
  messageType: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  sentAt: string;
  createdAt: string;
}

export interface AiAgentIntent {
  id: string;
  conversationId: string;
  agentId: string;
  messageId: string | null;
  intentType: string | null;
  intentSubtype: string | null;
  rawText: string | null;
  summary: string | null;
  structuredPayload: Record<string, unknown> | null;
  confidence: number | null;
  status: string;
  appliedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentMatchEvent {
  id: string;
  agentId: string;
  conversationId: string | null;
  intentId: string | null;
  matchType: string | null;
  demandRef: Record<string, unknown> | null;
  supplyRef: Record<string, unknown> | null;
  score: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Rides domain types
export interface RidesSavedLocation {
  id: string;
  userId: string;
  label: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RidesTrip {
  id: string;
  riderUserId: string;
  driverUserId: string | null;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  priceEstimate: number | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RidesDriverStatus {
  id: string;
  userId: string;
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastSeenAt: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// Insurance domain types
export interface InsuranceProfile {
  id: string;
  userId: string;
  vehicleIdentifier: string | null;
  vehicleMetadata: Record<string, unknown> | null;
  ownerName: string | null;
  ownerIdNumber: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceDocument {
  id: string;
  profileId: string;
  documentType: string | null;
  fileUrl: string | null;
  waMessageId: string | null;
  metadata: Record<string, unknown> | null;
  uploadedAt: string;
}

export interface InsuranceQuoteRequest {
  id: string;
  profileId: string;
  agentId: string;
  intentId: string | null;
  requestType: string | null;
  status: string;
  requestedAt: string;
  resolvedAt: string | null;
  quoteDetails: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// View types
export interface AiAgentsOverview {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  defaultLanguage: string | null;
  defaultChannel: string | null;
  isActive: boolean;
  defaultPersonaCode: string | null;
  defaultPersonaRoleName: string | null;
  defaultSystemInstructionCode: string | null;
  defaultSystemInstructionTitle: string | null;
  toolCount: number;
  taskCount: number;
  kbCount: number;
  createdAt: string;
  updatedAt: string;
}
