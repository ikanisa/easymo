/**
 * OpenAI Module - Main Exports
 */

export { 
  getOpenAIClient, 
  resetOpenAIClient, 
  healthCheckOpenAI 
} from './client';

export {
  createOpenAIAgent,
  runOpenAIAgent,
  createOpenAICompletion,
  streamOpenAICompletion,
  listOpenAIAgents,
  deleteOpenAIAgent,
} from './agents-sdk';

export {
  createRealtimeSession,
  sendRealtimeAudio,
  sendRealtimeText,
  subscribeRealtimeEvents,
  closeRealtimeSession,
  createVoiceAgent,
} from './realtime';

export type {
  OpenAIAgentOptions,
  AgentRunOptions,
} from './agents-sdk';

export type {
  RealtimeSession,
  RealtimeEvent,
  RealtimeEventHandler,
} from './realtime';
