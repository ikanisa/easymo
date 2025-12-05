/**
 * Voice Gateway Entry Point
 * 
 * Voice Gateway Service for SIP/WebRTC telephony integration.
 * Connects phone calls to AI agents via OpenAI Realtime API.
 * 
 * Features:
 * - OpenAI Realtime API integration with function calling
 * - Google Speech/TTS/Translate as alternative providers
 * - SIP trunk support (OpenAI native + MTN Rwanda)
 * - AGI tool integration for Call Center capabilities
 */

import { startServer } from './server';

// Export modules for testing and external use
export { 
  AGI_TOOL_DEFINITIONS, 
  executeAGITool, 
  formatToolResult,
  type RealtimeToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from './agi-tools';
export { type AIProvider, type ProviderConfig,UnifiedAIProvider } from './ai-provider';
export { config, validateConfig } from './config';
export { 
  CallSession, 
  type CallSessionConfig,
  type CallState,
  SessionManager, 
  sessionManager,
  type TranscriptChunk,
} from './session';
export {
  buildSIPURI,
  type CallRouteResult,
  getAllEnabledTrunks,
  getSIPTrunkConfig,
  type IncomingCallInfo,
  routeIncomingCall,
  type SIPProvider,
  type SIPTrunkConfig,
  validateSIPCredentials,
} from './sip-config';

// Start server when run directly
startServer();
