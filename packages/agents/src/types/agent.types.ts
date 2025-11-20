/**
 * Core types for AI Agent System
 */

export interface AgentInput {
  userId: string;
  query: string;
  location?: Location;
  image?: string;
  context?: AgentContext;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface AgentResult {
  success: boolean;
  finalOutput: string;
  data?: any;
  toolsInvoked: string[];
  duration: number;
  sessionId?: string;
  requiresConfirmation?: boolean;
  options?: any[];
  message?: string;
  error?: string;
  status?: string;
}

export interface AgentContext {
  userId: string;
  conversationId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: AgentContext) => Promise<any>;
}

export interface AgentDefinition {
  name: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
}

export interface AgentSession {
  id: string;
  userId: string;
  agentType: string;
  startTime: number;
  deadline?: number;
  status: 'active' | 'timeout' | 'completed' | 'error';
  results?: any[];
  extensions: number;
}

export interface VendorQuote {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  offer: any; // Changed to any to support number or object
  offerData?: any; // Added to support property details
  status?: string; // Added to support status
  score: number;
  timestamp: number;
}

export interface SearchResult {
  searchId: string;
  query: string;
  options: VendorQuote[];
  status: 'searching' | 'presenting' | 'completed' | 'timeout';
  startTime: number;
  completionTime?: number;
}
