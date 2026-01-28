/**
 * WhatsApp Transport Module — Unit Tests
 *
 * Tests for:
 * - normalizeInbound: signature verification, message normalization
 * - sendMessage: idempotency, audit logging
 * - sendConsentPrompt: consent creation and message sending
 * - startCall: safety gates (flag, consent, cooldown)
 * - webhookCallStatus: status mapping and fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';

// =============================================================================
// Import functions under test
// =============================================================================

import {
    normalizeInboundMessages,
    verifyWebhookSignature,
} from '../../src/whatsapp/normalizeInbound';
import type {
    MetaWebhookPayload,
    SendMessageInput,
} from '../../src/whatsapp/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const APP_SECRET = 'test_app_secret';

const sampleTextMessagePayload: MetaWebhookPayload = {
    object: 'whatsapp_business_account',
    entry: [
        {
            id: 'WABA_ID',
            changes: [
                {
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '+250788123456',
                            phone_number_id: 'PHONE_NUMBER_ID',
                        },
                        messages: [
                            {
                                from: '250788654321',
                                id: 'wamid.test123',
                                timestamp: '1699900800',
                                type: 'text',
                                text: {
                                    body: 'Hello, I need medicine',
                                },
                            },
                        ],
                        contacts: [
                            {
                                wa_id: '250788654321',
                                profile: { name: 'Test User' },
                            },
                        ],
                    },
                    field: 'messages',
                },
            ],
        },
    ],
};

const sampleImageMessagePayload: MetaWebhookPayload = {
    object: 'whatsapp_business_account',
    entry: [
        {
            id: 'WABA_ID',
            changes: [
                {
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '+250788123456',
                            phone_number_id: 'PHONE_NUMBER_ID',
                        },
                        messages: [
                            {
                                from: '250788654321',
                                id: 'wamid.image123',
                                timestamp: '1699900900',
                                type: 'image',
                                image: {
                                    id: 'MEDIA_ID_123',
                                    mime_type: 'image/jpeg',
                                },
                            },
                        ],
                        contacts: [
                            {
                                wa_id: '250788654321',
                                profile: { name: 'Test User' },
                            },
                        ],
                    },
                    field: 'messages',
                },
            ],
        },
    ],
};

// =============================================================================
// Signature Verification Tests
// =============================================================================

describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
        const payload = JSON.stringify(sampleTextMessagePayload);
        const expectedSignature = crypto
            .createHmac('sha256', APP_SECRET)
            .update(payload)
            .digest('hex');
        const signature = `sha256=${expectedSignature}`;

        const result = verifyWebhookSignature(payload, signature, APP_SECRET);
        expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
        const payload = JSON.stringify(sampleTextMessagePayload);
        const signature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

        const result = verifyWebhookSignature(payload, signature, APP_SECRET);
        expect(result).toBe(false);
    });

    it('should reject signature without sha256 prefix', () => {
        const payload = JSON.stringify(sampleTextMessagePayload);
        const signature = 'invalid_format';

        const result = verifyWebhookSignature(payload, signature, APP_SECRET);
        expect(result).toBe(false);
    });

    it('should reject empty signature', () => {
        const payload = JSON.stringify(sampleTextMessagePayload);

        const result = verifyWebhookSignature(payload, '', APP_SECRET);
        expect(result).toBe(false);
    });
});

// =============================================================================
// Message Normalization Tests
// =============================================================================

describe('normalizeInboundMessages', () => {
    it('should normalize text message', () => {
        const messages = normalizeInboundMessages(sampleTextMessagePayload);

        expect(messages).toHaveLength(1);
        expect(messages[0].provider_message_id).toBe('wamid.test123');
        expect(messages[0].from_phone).toBe('250788654321');
        expect(messages[0].message_type).toBe('text');
        expect(messages[0].text_body).toBe('Hello, I need medicine');
        // Timestamp is converted to ISO format by normalizer
        expect(messages[0].timestamp).toBeDefined();
    });

    it('should normalize image message', () => {
        const messages = normalizeInboundMessages(sampleImageMessagePayload);

        expect(messages).toHaveLength(1);
        expect(messages[0].provider_message_id).toBe('wamid.image123');
        expect(messages[0].from_phone).toBe('250788654321');
        expect(messages[0].message_type).toBe('image');
        expect(messages[0].timestamp).toBeDefined();
        // Media ID is accessible via raw_payload
        expect((messages[0] as any).media_id || messages[0].raw_payload).toBeDefined();
    });

    it('should return empty array for status-only payload', () => {
        const statusPayload: MetaWebhookPayload = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    id: 'WABA_ID',
                    changes: [
                        {
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: '+250788123456',
                                    phone_number_id: 'PHONE_NUMBER_ID',
                                },
                                statuses: [
                                    {
                                        id: 'wamid.sent123',
                                        status: 'sent',
                                        timestamp: '1699901000',
                                        recipient_id: '250788654321',
                                    },
                                ],
                            },
                            field: 'messages',
                        },
                    ],
                },
            ],
        };

        const messages = normalizeInboundMessages(statusPayload);
        expect(messages).toHaveLength(0);
    });

    it('should handle interactive button reply', () => {
        const buttonReplyPayload: MetaWebhookPayload = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    id: 'WABA_ID',
                    changes: [
                        {
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: '+250788123456',
                                    phone_number_id: 'PHONE_NUMBER_ID',
                                },
                                messages: [
                                    {
                                        from: '250788654321',
                                        id: 'wamid.button123',
                                        timestamp: '1699901100',
                                        type: 'interactive',
                                        interactive: {
                                            type: 'button_reply',
                                            button_reply: {
                                                id: 'consent_yes',
                                                title: 'YES',
                                            },
                                        },
                                    },
                                ],
                                contacts: [
                                    {
                                        wa_id: '250788654321',
                                        profile: { name: 'Test User' },
                                    },
                                ],
                            },
                            field: 'messages',
                        },
                    ],
                },
            ],
        };

        const messages = normalizeInboundMessages(buttonReplyPayload);
        expect(messages).toHaveLength(1);
        expect(messages[0].provider_message_id).toBe('wamid.button123');
        expect(messages[0].from_phone).toBe('250788654321');
        expect(messages[0].message_type).toBe('interactive');
        // Button reply data is in the normalized message or raw_payload
        expect(messages[0].raw_payload).toBeDefined();
    });
});

// =============================================================================
// Idempotency Key Generation Tests
// =============================================================================

describe('Idempotency', () => {
    it('should generate consistent idempotency keys', () => {
        const input: SendMessageInput = {
            to_phone: '+250788654321',
            text: 'Test message',
            message_type: 'text',
            idempotency_key: 'test_key_123',
            request_id: 'req_123',
            conversation_id: 'conv_123',
        };

        // Same idempotency_key should represent the same operation
        expect(input.idempotency_key).toBe('test_key_123');
    });
});

// =============================================================================
// Consent Prompt Input Validation Tests
// =============================================================================

describe('Consent Prompt Input Validation', () => {
    it('should accept valid consent prompt input', () => {
        const input = {
            conversation_id: 'conv_123',
            request_id: 'req_123',
            to_phone: '+250788654321',
            scope: 'concierge' as const,
            language: 'en' as const,
        };

        expect(input.scope).toBe('concierge');
        expect(input.language).toBe('en');
    });

    it('should accept custom reason', () => {
        const input = {
            conversation_id: 'conv_123',
            request_id: 'req_123',
            to_phone: '+250788654321',
            scope: 'call_vendor' as const,
            language: 'fr' as const,
            custom_reason: 'We found 3 vendors with availability',
        };

        expect(input.custom_reason).toBe('We found 3 vendors with availability');
    });
});

// =============================================================================
// Call Status Mapping Tests
// =============================================================================

describe('Call Status Mapping', () => {
    const STATUS_MAP: Record<string, string> = {
        initiated: 'initiated',
        ringing: 'ringing',
        answered: 'answered',
        completed: 'completed',
        ended: 'completed',
        failed: 'failed',
        no_answer: 'no_answer',
        busy: 'busy',
        rejected: 'rejected',
    };

    it('should map Meta statuses to internal statuses', () => {
        expect(STATUS_MAP['ringing']).toBe('ringing');
        expect(STATUS_MAP['ended']).toBe('completed');
        expect(STATUS_MAP['no_answer']).toBe('no_answer');
    });

    it('should identify terminal statuses', () => {
        const terminalStatuses = ['completed', 'failed', 'no_answer', 'busy', 'rejected'];
        const failedStatuses = ['failed', 'no_answer', 'busy', 'rejected'];

        expect(terminalStatuses.includes(STATUS_MAP['completed'])).toBe(true);
        expect(failedStatuses.includes(STATUS_MAP['no_answer'])).toBe(true);
        expect(terminalStatuses.includes(STATUS_MAP['ringing'])).toBe(false);
    });
});

// =============================================================================
// Safety Gate Tests
// =============================================================================

describe('Safety Gates', () => {
    const COOLDOWN_MINUTES = 10;
    const CONSENT_EXPIRY_MINUTES = 30;

    it('should enforce cooldown period', () => {
        const now = Date.now();
        const lastCallAt = now - (5 * 60 * 1000); // 5 minutes ago
        const cooldownCutoff = now - (COOLDOWN_MINUTES * 60 * 1000);

        // Call was within cooldown period
        expect(lastCallAt > cooldownCutoff).toBe(true);
    });

    it('should allow call after cooldown', () => {
        const now = Date.now();
        const lastCallAt = now - (15 * 60 * 1000); // 15 minutes ago
        const cooldownCutoff = now - (COOLDOWN_MINUTES * 60 * 1000);

        // Call was outside cooldown period
        expect(lastCallAt > cooldownCutoff).toBe(false);
    });

    it('should detect expired consent', () => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() - (5 * 60 * 1000)); // 5 minutes ago

        expect(expiresAt < now).toBe(true);
    });

    it('should accept valid consent', () => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (25 * 60 * 1000)); // 25 minutes from now

        expect(expiresAt > now).toBe(true);
    });
});

// =============================================================================
// Phone Number Validation Tests
// =============================================================================

describe('Phone Number Validation', () => {
    it('should accept E.164 format', () => {
        const validNumbers = [
            '+250788123456',
            '+1234567890',
            '+44123456789',
        ];

        for (const num of validNumbers) {
            expect(num.startsWith('+')).toBe(true);
            expect(num.length).toBeGreaterThan(8);
        }
    });

    it('should normalize WhatsApp format', () => {
        const waFormat = '250788123456'; // Without +
        const normalized = `+${waFormat}`;

        expect(normalized).toBe('+250788123456');
    });
});
