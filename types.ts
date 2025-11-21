
export enum AgentMode {
  LIVE_CALL = 'LIVE_CALL',
  LEAD_GEN = 'LEAD_GEN',
  STRATEGY_CHAT = 'STRATEGY_CHAT',
  TRANSCRIPTION = 'TRANSCRIPTION',
  DASHBOARD = 'DASHBOARD',
  AGENT_MANAGER = 'AGENT_MANAGER',
  BUSINESS_DIRECTORY = 'BUSINESS_DIRECTORY'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
  groundingMetadata?: any; // For Search/Maps results
}

export interface ContactLead {
  name: string;
  phone?: string;
  address?: string;
  source: 'search' | 'maps';
  uri?: string;
}

export interface SimulationStat {
  activeCalls: number;
  connectedToMTN: boolean;
  leadsFound: number;
  conversions: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export interface AgentTool {
  name: string;
  description: string;
  schema: string;
  endpoint: string;
  active: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'AB_TEST';
  targetAudience: string;
  lastUpdated: string;
  persona: {
    systemInstruction: string;
    voice: string;
    callObjective: string;
    objectionHandling: string; // JSON string
    qualificationSchema: string; // JSON string
  };
  modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  knowledgeBase: {
    driveFolderId: string;
    active: boolean;
    indexedFiles: number;
    lastSync: string;
  };
  tools: AgentTool[];
  stats: {
    calls24h: number;
    connectRate: string;
    qualificationRate: string;
    avgDuration: string;
  };
}

export interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DO_NOT_CALL';
  rating: number;
  lat: number;
  lng: number;
  lastChecked: string;
  website?: string;
  notes?: string;
}
