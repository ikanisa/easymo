/**
 * Moltbot Orchestrator
 *
 * Main entry point for the Moltbot orchestration layer.
 */

export { handleInboundMessage } from './handleInboundMessage';
export type { InboundMessageEvent, HandleInboundResult } from './handleInboundMessage';

export { executeToolAction } from './tools';
export { logAuditEvent } from './audit';
export { checkFeatureFlag, getMoltbotFlags } from './flags';
