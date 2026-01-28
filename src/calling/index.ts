/**
 * Calling Module — Barrel Export
 *
 * Meta WhatsApp Business Calling integration with consent management.
 */

// Types
export * from './types';

// Tools
export { requestCallConsent } from './requestCallConsent';
export { startCall, COOLDOWN_MINUTES } from './startCall';

// Handlers
export {
    handleConsentReply,
    parseConsentReply,
    AFFIRMATIVE_PATTERNS,
    NEGATIVE_PATTERNS,
} from './consentHandler';

export {
    handleCallStatusWebhook,
    handleWebhookVerification,
} from './callStatusWebhook';
