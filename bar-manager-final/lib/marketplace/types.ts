export interface MarketplaceConversationMessage {
  id: string;
  direction: "user" | "assistant";
  content: string;
  createdAt: string;
  agentDisplayName?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MarketplaceConversation {
  threadId: string;
  conversationId: string | null;
  customerMsisdn: string | null;
  lastMessageAt: string | null;
  messages: MarketplaceConversationMessage[];
}

export interface MarketplaceQuote {
  id: string;
  vendorId: string | null;
  vendorType: string;
  vendorName: string | null;
  offerData: Record<string, unknown>;
  status: string;
  respondedAt: string | null;
  rankingScore: number | null;
  metadata: Record<string, unknown>;
}

export interface MarketplaceVendorResponse {
  id: string;
  quoteId: string | null;
  vendorId: string | null;
  vendorType: string;
  channel: string;
  requestMessage: string | null;
  responseMessage: string | null;
  parsed: Record<string, unknown>;
  sentAt: string | null;
  receivedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface MarketplaceCustomerSummary {
  msisdn: string | null;
  location: { lat: number; lng: number } | null;
}

export interface MarketplaceAgentSession {
  id: string;
  agentType: string;
  flowType: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  requestData: Record<string, unknown>;
  customer: MarketplaceCustomerSummary;
  waThreadId: string | null;
  quotes: MarketplaceQuote[];
  vendorResponses: MarketplaceVendorResponse[];
  conversation: MarketplaceConversation | null;
}
