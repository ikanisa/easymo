/**
 * WhatsApp Transport Layer — Barrel Export
 *
 * Unified module for all WhatsApp interactions:
 * - Inbound message normalization
 * - Outbound messaging (text, interactive)
 * - Call initiation and status handling
 * - Webhook handlers
 */

// Types
export * from './types';

// Inbound Normalization
export {
    normalizeInboundMessages,
    fetchMediaUrl,
    verifyWebhookSignature,
} from './normalizeInbound';

// Outbound Messaging
export {
    sendMessage,
    sendTextMessage,
    sendButtonMessage,
} from './sendMessage';

// Webhook Handlers
export { handleInboundWebhook } from './webhookInbound';
export { handleCallStatusWebhook as handleCallWebhook } from './webhookCallStatus';

// Consent & Calling
export { sendConsentPrompt } from './sendConsentPrompt';
export { initiateCall } from './startCall';
