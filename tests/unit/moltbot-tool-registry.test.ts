/**
 * Moltbot Tool Registry Tests
 *
 * Tests for:
 * - Output contract validation
 * - Idempotent message handling
 * - Vendor batch limits
 * - Consent gate enforcement
 */

import { describe, it, expect } from 'vitest';
import {
    validateMoltbotOutput,
    MoltbotActionAskClient,
    MoltbotActionVendorOutreachPlan,
    MoltbotActionShortlist,
    MoltbotActionEscalate,
} from '@easymo/types';

// =============================================================================
// Output Contract Validation Tests
// =============================================================================

describe('validateMoltbotOutput', () => {
    describe('ask_client', () => {
        it('accepts valid ask_client action', () => {
            const action: MoltbotActionAskClient = {
                type: 'ask_client',
                question_text: 'What product are you looking for?',
                why: 'Need to understand requirements',
                options: ['Medicine', 'Electronics', 'Other'],
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(true);
            if (result.valid) {
                expect(result.action.type).toBe('ask_client');
            }
        });

        it('rejects ask_client without question_text', () => {
            const action = {
                type: 'ask_client',
                why: 'Need info',
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('question_text');
            }
        });

        it('rejects ask_client without why', () => {
            const action = {
                type: 'ask_client',
                question_text: 'What do you need?',
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
        });
    });

    describe('vendor_outreach_plan', () => {
        it('accepts valid vendor_outreach_plan', () => {
            const action: MoltbotActionVendorOutreachPlan = {
                type: 'vendor_outreach_plan',
                category: 'pharmacy',
                normalized_need: 'Paracetamol 500mg',
                batch_size: 5,
                vendor_questions: ['Do you have Paracetamol 500mg in stock?', 'What is the price?'],
                stop_conditions: { max_vendors: 15, min_replies: 3 },
                calling_allowed: false,
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(true);
        });

        it('rejects batch_size > 5', () => {
            const action = {
                type: 'vendor_outreach_plan',
                category: 'pharmacy',
                normalized_need: 'Medicine',
                batch_size: 10, // Exceeds limit
                vendor_questions: ['Question?'],
                stop_conditions: { max_vendors: 15 },
                calling_allowed: false,
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('batch_size');
            }
        });

        it('rejects max_vendors > 15', () => {
            const action = {
                type: 'vendor_outreach_plan',
                category: 'pharmacy',
                normalized_need: 'Medicine',
                batch_size: 5,
                vendor_questions: ['Question?'],
                stop_conditions: { max_vendors: 20 }, // Exceeds limit
                calling_allowed: false,
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('max_vendors');
            }
        });
    });

    describe('shortlist', () => {
        it('accepts valid shortlist', () => {
            const action: MoltbotActionShortlist = {
                type: 'shortlist',
                summary_text: 'I found 3 pharmacies with Paracetamol:',
                items: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Pharmacy A',
                        vendor_phone: '+250780000001',
                        response_summary: 'In stock, 500 RWF',
                    },
                ],
                handoff: { type: 'wa_link' },
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(true);
        });

        it('rejects shortlist without handoff', () => {
            const action = {
                type: 'shortlist',
                summary_text: 'Found items',
                items: [],
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
        });
    });

    describe('escalate', () => {
        it('accepts valid escalate', () => {
            const action: MoltbotActionEscalate = {
                type: 'escalate',
                reason: 'Cannot understand request after 3 attempts',
                safe_client_message: 'Let me connect you with a human agent.',
                to: 'human',
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(true);
        });

        it('rejects escalate without safe_client_message', () => {
            const action = {
                type: 'escalate',
                reason: 'Error occurred',
            };

            const result = validateMoltbotOutput(action);
            expect(result.valid).toBe(false);
        });
    });

    describe('invalid output handling', () => {
        it('rejects null output', () => {
            const result = validateMoltbotOutput(null);
            expect(result.valid).toBe(false);
        });

        it('rejects undefined output', () => {
            const result = validateMoltbotOutput(undefined);
            expect(result.valid).toBe(false);
        });

        it('rejects output without type', () => {
            const result = validateMoltbotOutput({ foo: 'bar' });
            expect(result.valid).toBe(false);
        });

        it('rejects unknown action type', () => {
            const result = validateMoltbotOutput({ type: 'unknown_action' });
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toContain('Unknown action type');
            }
        });

        it('rejects raw string', () => {
            const result = validateMoltbotOutput('Just a string response');
            expect(result.valid).toBe(false);
        });
    });
});

// =============================================================================
// Idempotency Tests (require Supabase connection)
// =============================================================================

describe.skip('Idempotent Message Handling', () => {
    it('same message twice creates only one record', async () => {
        // This test requires Supabase connection
        // See tests/integration/moltbot-backbone.test.ts
    });
});

// =============================================================================
// Consent Gate Tests
// =============================================================================

describe.skip('Consent Gate', () => {
    it('start_call fails without consent', async () => {
        // This test requires Supabase connection and consent table
    });

    it('start_call fails with expired consent', async () => {
        // This test requires Supabase connection
    });

    it('start_call succeeds with valid granted consent', async () => {
        // This test requires Supabase connection
    });
});
