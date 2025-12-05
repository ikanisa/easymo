/**
 * @easymo/call-capability
 * 
 * Unified call handling capability for all easyMO agents.
 * Provides call session management, transcript logging, summarization,
 * and ADK-compatible tools for voice/WhatsApp call handling.
 * 
 * @example
 * ```typescript
 * import { CallSession, TranscriptLogger, CallSummarizer } from '@easymo/call-capability';
 * 
 * // Start a call session
 * const session = new CallSession(supabase);
 * const call = await session.start({
 *   agent_id: 'farmers_ai',
 *   channel: 'whatsapp_call',
 *   direction: 'inbound',
 *   from_number: '+250788000000',
 * });
 * 
 * // Log transcript chunks
 * const logger = new TranscriptLogger(supabase, call.id);
 * await logger.addUserMessage('Hello, I have tomatoes to sell');
 * await logger.addAssistantMessage('Great! How many kilograms?');
 * 
 * // Summarize at end
 * const summarizer = new CallSummarizer(supabase);
 * const summary = await summarizer.summarize(call.id);
 * 
 * // End call
 * await session.end('completed');
 * ```
 */

// Core types
export * from './types';

// Session management
export { CallSession, CallSessionHelpers, default as CallSessionDefault } from './call-session';

// Transcript logging
export { TranscriptLogger, TranscriptHelpers, default as TranscriptLoggerDefault } from './transcript-logger';

// Summarization
export {
  CallSummarizer,
  SummaryHelpers,
  type SummarizerCallback,
  type SummarizerConfig,
  type ExtractedEntities,
  default as CallSummarizerDefault,
} from './summarizer';

// ADK Tools
export {
  // Call tools
  saveCallEventTool,
  appendTranscriptTool,
  saveSummaryTool,
  executeSaveCallEvent,
  executeAppendTranscript,
  executeSaveSummary,
  CALL_TOOLS,
  CALL_TOOL_EXECUTORS,
  getCallToolSchemas,
  executeCallTool,
  type ToolContext,
  // Domain intake tools
  upsertJobsIntakeTool,
  upsertFarmersIntakeTool,
  upsertRealEstateIntakeTool,
  executeUpsertJobsIntake,
  executeUpsertFarmersIntake,
  executeUpsertRealEstateIntake,
  DOMAIN_INTAKE_TOOLS,
  DOMAIN_INTAKE_EXECUTORS,
  executeDomainIntakeTool,
} from './tools';

// Convenience: all tools combined
export function getAllCallCapabilityTools() {
  const { CALL_TOOLS } = require('./tools/call-tools');
  const { DOMAIN_INTAKE_TOOLS } = require('./tools/domain-intake-tools');
  return [...CALL_TOOLS, ...DOMAIN_INTAKE_TOOLS];
}
