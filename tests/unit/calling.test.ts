/**
 * Calling Tools Unit Tests
 *
 * Tests for:
 * 1. start_call fails without consent
 * 2. start_call fails when request is handed_off
 * 3. Duplicate calls prevented by cooldown
 * 4. Callback updates status and triggers fallback on failure
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Test configuration
const TEST_CONFIG = {
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
};

// Test IDs
const TEST_IDS = {
    conversationId: '00000000-0000-0000-2000-000000000001',
    requestId: '00000000-0000-0000-2000-000000000002',
    consentId: '00000000-0000-0000-2000-000000000003',
    vendorId: '00000000-0000-0000-2000-000000000004',
};

let supabase: SupabaseClient;

const RUN_DB_TESTS = process.env.EASYMO_RUN_DB_TESTS === 'true';
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

describeDb('Calling Tools', () => {
    beforeAll(async () => {
        supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        await cleanupTestData();
        await setupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    async function cleanupTestData() {
        await supabase.from('moltbot_call_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('moltbot_call_consents').delete().eq('conversation_id', TEST_IDS.conversationId);
        await supabase.from('moltbot_marketplace_requests').delete().eq('id', TEST_IDS.requestId);
        await supabase.from('moltbot_conversations').delete().eq('id', TEST_IDS.conversationId);
    }

    async function setupTestData() {
        // Create test conversation
        await supabase.from('moltbot_conversations').insert({
            id: TEST_IDS.conversationId,
            channel: 'whatsapp',
            client_phone: '+250788009999',
            language: 'en',
        });

        // Create test request
        await supabase.from('moltbot_marketplace_requests').insert({
            id: TEST_IDS.requestId,
            conversation_id: TEST_IDS.conversationId,
            state: 'vendor_outreach',
        });
    }

    // =========================================================================
    // Test 1: start_call fails without consent
    // =========================================================================
    describe('start_call without consent', () => {
        it('should fail when consent record does not exist', async () => {
            // Import dynamically to avoid module resolution issues in test
            const { startCall, CallingError } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: 'non-existent-id' }, { skipFlagCheck: true })
            ).rejects.toThrow('Consent not found');
        });

        it('should fail when consent state is not granted', async () => {
            // Create consent in 'requested' state
            const { data: consent } = await supabase
                .from('moltbot_call_consents')
                .insert({
                    id: TEST_IDS.consentId,
                    conversation_id: TEST_IDS.conversationId,
                    state: 'requested',
                    scope: 'concierge',
                    requested_at: new Date().toISOString(),
                })
                .select()
                .single();

            const { startCall } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: TEST_IDS.consentId }, { skipFlagCheck: true })
            ).rejects.toThrow('Invalid consent state');

            // Cleanup
            await supabase.from('moltbot_call_consents').delete().eq('id', TEST_IDS.consentId);
        });

        it('should fail when consent is denied', async () => {
            const { data: consent } = await supabase
                .from('moltbot_call_consents')
                .insert({
                    id: TEST_IDS.consentId,
                    conversation_id: TEST_IDS.conversationId,
                    state: 'denied',
                    scope: 'concierge',
                    denied_at: new Date().toISOString(),
                })
                .select()
                .single();

            const { startCall } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: TEST_IDS.consentId }, { skipFlagCheck: true })
            ).rejects.toThrow('denied');

            await supabase.from('moltbot_call_consents').delete().eq('id', TEST_IDS.consentId);
        });
    });

    // =========================================================================
    // Test 2: start_call fails when request is handed_off
    // =========================================================================
    describe('start_call with terminal request state', () => {
        it('should fail when request is in handed_off state', async () => {
            // Create granted consent
            await supabase.from('moltbot_call_consents').insert({
                id: TEST_IDS.consentId,
                conversation_id: TEST_IDS.conversationId,
                state: 'granted',
                scope: 'concierge',
                granted_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });

            // Update request to handed_off
            await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'handed_off' })
                .eq('id', TEST_IDS.requestId);

            const { startCall } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: TEST_IDS.consentId }, { skipFlagCheck: true })
            ).rejects.toThrow('terminal state');

            // Cleanup
            await supabase.from('moltbot_call_consents').delete().eq('id', TEST_IDS.consentId);
            await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'vendor_outreach' })
                .eq('id', TEST_IDS.requestId);
        });
    });

    // =========================================================================
    // Test 3: Duplicate calls prevented by cooldown
    // =========================================================================
    describe('cooldown enforcement', () => {
        it('should reject second call within cooldown period', async () => {
            // Create granted consent
            await supabase.from('moltbot_call_consents').insert({
                id: TEST_IDS.consentId,
                conversation_id: TEST_IDS.conversationId,
                state: 'granted',
                scope: 'concierge',
                granted_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });

            // Create a recent call attempt
            await supabase.from('moltbot_call_attempts').insert({
                consent_id: TEST_IDS.consentId,
                status: 'completed',
                initiated_at: new Date().toISOString(),
                ended_at: new Date().toISOString(),
            });

            const { startCall, COOLDOWN_MINUTES } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: TEST_IDS.consentId }, { skipFlagCheck: true })
            ).rejects.toThrow('Cooldown active');

            // Cleanup
            await supabase.from('moltbot_call_attempts').delete().eq('consent_id', TEST_IDS.consentId);
            await supabase.from('moltbot_call_consents').delete().eq('id', TEST_IDS.consentId);
        });
    });

    // =========================================================================
    // Test 4: Consent reply parsing
    // =========================================================================
    describe('consent reply parsing', () => {
        it('should recognize affirmative replies in multiple languages', async () => {
            const { parseConsentReply } = await import('../../src/calling');

            expect(parseConsentReply('yes')).toBe('yes');
            expect(parseConsentReply('YES')).toBe('yes');
            expect(parseConsentReply('oui')).toBe('yes');
            expect(parseConsentReply('yego')).toBe('yes');
            expect(parseConsentReply('ok')).toBe('yes');
        });

        it('should recognize negative replies in multiple languages', async () => {
            const { parseConsentReply } = await import('../../src/calling');

            expect(parseConsentReply('no')).toBe('no');
            expect(parseConsentReply('NO')).toBe('no');
            expect(parseConsentReply('non')).toBe('no');
            expect(parseConsentReply('oya')).toBe('no');
        });

        it('should return null for unrecognized messages', async () => {
            const { parseConsentReply } = await import('../../src/calling');

            expect(parseConsentReply('hello')).toBeNull();
            expect(parseConsentReply('maybe')).toBeNull();
            expect(parseConsentReply('I need medicine')).toBeNull();
        });
    });

    // =========================================================================
    // Test 5: Consent expiration
    // =========================================================================
    describe('consent expiration', () => {
        it('should fail when consent has expired', async () => {
            // Create expired consent
            await supabase.from('moltbot_call_consents').insert({
                id: TEST_IDS.consentId,
                conversation_id: TEST_IDS.conversationId,
                state: 'granted',
                scope: 'concierge',
                granted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
            });

            const { startCall } = await import('../../src/calling');

            await expect(
                startCall(supabase, { consent_id: TEST_IDS.consentId }, { skipFlagCheck: true })
            ).rejects.toThrow('expired');

            // Verify consent was updated to expired
            const { data: updatedConsent } = await supabase
                .from('moltbot_call_consents')
                .select('state')
                .eq('id', TEST_IDS.consentId)
                .single();

            expect(updatedConsent?.state).toBe('expired');

            // Cleanup
            await supabase.from('moltbot_call_consents').delete().eq('id', TEST_IDS.consentId);
        });
    });
});
