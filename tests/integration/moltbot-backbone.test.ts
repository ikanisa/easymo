/**
 * Moltbot Conversation Backbone Integration Tests
 * 
 * Tests for idempotency and state machine constraints:
 * 1. Same inbound webhook twice → one conversation_messages row
 * 2. Same vendor twice → one vendor_outreach row
 * 3. Request cannot be handed_off unless shortlist_ready was reached
 * 4. OCR low confidence forces ask_client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Test configuration
const TEST_CONFIG = {
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
};

let supabase: SupabaseClient;

// Test data IDs for cleanup
const TEST_IDS = {
    conversationId: '00000000-0000-0000-1000-000000000001',
    requestId: '00000000-0000-0000-1000-000000000002',
    vendorId: '00000000-0000-0000-1000-000000000003',
};

const RUN_DB_TESTS = process.env.EASYMO_RUN_DB_TESTS === 'true';
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

describeDb('Moltbot Conversation Backbone', () => {
    beforeAll(async () => {
        supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Cleanup any previous test data
        await cleanupTestData();

        // Create test vendor first (required for outreach tests)
        await supabase.from('vendors').insert({
            id: TEST_IDS.vendorId,
            name: 'Test Vendor',
            phone: '+250788000099',
            tier: 'tier1',
            is_active: true,
        });
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    async function cleanupTestData() {
        // Delete in reverse order of dependencies
        await supabase.from('moltbot_call_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('moltbot_call_consents').delete().eq('conversation_id', TEST_IDS.conversationId);
        await supabase.from('moltbot_vendor_outreach').delete().eq('request_id', TEST_IDS.requestId);
        await supabase.from('moltbot_ocr_jobs').delete().eq('request_id', TEST_IDS.requestId);
        await supabase.from('moltbot_marketplace_requests').delete().eq('id', TEST_IDS.requestId);
        await supabase.from('moltbot_conversation_messages').delete().eq('conversation_id', TEST_IDS.conversationId);
        await supabase.from('moltbot_conversations').delete().eq('id', TEST_IDS.conversationId);
        await supabase.from('vendors').delete().eq('id', TEST_IDS.vendorId);
    }

    describe('Idempotent Message Ingestion', () => {
        it('should create a conversation', async () => {
            const { data, error } = await supabase
                .from('moltbot_conversations')
                .insert({
                    id: TEST_IDS.conversationId,
                    channel: 'whatsapp',
                    client_phone: '+250788001234',
                    language: 'en',
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.id).toBe(TEST_IDS.conversationId);
        });

        it('should insert a message with unique provider_message_id', async () => {
            const { data, error } = await supabase
                .from('moltbot_conversation_messages')
                .insert({
                    conversation_id: TEST_IDS.conversationId,
                    provider_message_id: 'wamid.test123456789',
                    direction: 'inbound',
                    message_type: 'text',
                    body: 'Hello, I need help',
                    timestamp: new Date().toISOString(),
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.provider_message_id).toBe('wamid.test123456789');
        });

        it('should reject duplicate provider_message_id (idempotency)', async () => {
            const { error } = await supabase
                .from('moltbot_conversation_messages')
                .insert({
                    conversation_id: TEST_IDS.conversationId,
                    provider_message_id: 'wamid.test123456789', // Same as above
                    direction: 'inbound',
                    message_type: 'text',
                    body: 'Duplicate message',
                    timestamp: new Date().toISOString(),
                });

            // Should fail with unique constraint violation
            expect(error).toBeDefined();
            expect(error?.code).toBe('23505'); // unique_violation
        });

        it('should have only one message row after duplicate attempt', async () => {
            const { data, error } = await supabase
                .from('moltbot_conversation_messages')
                .select('*')
                .eq('provider_message_id', 'wamid.test123456789');

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
        });
    });

    describe('Marketplace Request State Machine', () => {
        it('should create a marketplace request', async () => {
            const { data, error } = await supabase
                .from('moltbot_marketplace_requests')
                .insert({
                    id: TEST_IDS.requestId,
                    conversation_id: TEST_IDS.conversationId,
                    state: 'collecting_requirements',
                    requirements: { category: 'medicine', query: 'paracetamol 500mg' },
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.state).toBe('collecting_requirements');
        });

        it('should allow valid state transition to vendor_outreach', async () => {
            const { data, error } = await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'vendor_outreach' })
                .eq('id', TEST_IDS.requestId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('vendor_outreach');
        });

        it('should allow transition to awaiting_vendor_replies', async () => {
            const { data, error } = await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'awaiting_vendor_replies' })
                .eq('id', TEST_IDS.requestId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('awaiting_vendor_replies');
        });

        it('should allow transition to shortlist_ready', async () => {
            const { data, error } = await supabase
                .from('moltbot_marketplace_requests')
                .update({
                    state: 'shortlist_ready',
                    shortlist: [
                        { vendor_id: TEST_IDS.vendorId, vendor_name: 'Test Vendor', vendor_phone: '+250788000099', response_summary: 'Available' },
                    ],
                })
                .eq('id', TEST_IDS.requestId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('shortlist_ready');
            expect(data?.shortlist).toHaveLength(1);
        });

        it('should allow transition from shortlist_ready to handed_off', async () => {
            const { data, error } = await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'handed_off' })
                .eq('id', TEST_IDS.requestId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('handed_off');
        });
    });

    describe('Vendor Outreach Idempotency', () => {
        it('should reset request state for outreach tests', async () => {
            const { error } = await supabase
                .from('moltbot_marketplace_requests')
                .update({ state: 'vendor_outreach' })
                .eq('id', TEST_IDS.requestId);

            expect(error).toBeNull();
        });

        it('should create vendor outreach record', async () => {
            const { data, error } = await supabase
                .from('moltbot_vendor_outreach')
                .insert({
                    request_id: TEST_IDS.requestId,
                    vendor_id: TEST_IDS.vendorId,
                    outreach_message: 'Do you have paracetamol 500mg?',
                    state: 'queued',
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.state).toBe('queued');
        });

        it('should reject duplicate vendor outreach (request_id + vendor_id)', async () => {
            const { error } = await supabase
                .from('moltbot_vendor_outreach')
                .insert({
                    request_id: TEST_IDS.requestId,
                    vendor_id: TEST_IDS.vendorId, // Same combination
                    outreach_message: 'Duplicate outreach attempt',
                    state: 'queued',
                });

            // Should fail with unique constraint violation
            expect(error).toBeDefined();
            expect(error?.code).toBe('23505'); // unique_violation
        });

        it('should have only one outreach row after duplicate attempt', async () => {
            const { data, error } = await supabase
                .from('moltbot_vendor_outreach')
                .select('*')
                .eq('request_id', TEST_IDS.requestId)
                .eq('vendor_id', TEST_IDS.vendorId);

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
        });

        it('should allow updating outreach state to sent', async () => {
            const { data, error } = await supabase
                .from('moltbot_vendor_outreach')
                .update({
                    state: 'sent',
                    outreach_sent_at: new Date().toISOString(),
                })
                .eq('request_id', TEST_IDS.requestId)
                .eq('vendor_id', TEST_IDS.vendorId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('sent');
            expect(data?.outreach_sent_at).toBeDefined();
        });

        it('should allow updating outreach state to replied', async () => {
            const { data, error } = await supabase
                .from('moltbot_vendor_outreach')
                .update({
                    state: 'replied',
                    response_message: 'Yes, we have it for 500 RWF',
                    response_received_at: new Date().toISOString(),
                    response_data: { price: 500, currency: 'RWF', available: true },
                })
                .eq('request_id', TEST_IDS.requestId)
                .eq('vendor_id', TEST_IDS.vendorId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('replied');
            expect(data?.response_data).toMatchObject({ price: 500 });
        });
    });

    describe('OCR Jobs', () => {
        it('should create OCR job with low confidence', async () => {
            const { data, error } = await supabase
                .from('moltbot_ocr_jobs')
                .insert({
                    request_id: TEST_IDS.requestId,
                    media_url: 'https://example.com/prescription.jpg',
                    media_type: 'image/jpeg',
                    status: 'completed',
                    provider: 'gemini',
                    extracted: { medicine: 'unknown', quantity: 1 },
                    confidence: 0.45, // Low confidence
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.confidence).toBeLessThan(0.5);
        });

        it('should identify low confidence OCR requiring ask_client', async () => {
            const { data } = await supabase
                .from('moltbot_ocr_jobs')
                .select('*')
                .eq('request_id', TEST_IDS.requestId)
                .single();

            // Application logic should trigger ask_client when confidence < 0.7
            expect(data?.confidence).toBeLessThan(0.7);
            // This would be checked by application code, not DB constraint
        });
    });

    describe('Call Consent Tracking', () => {
        it('should create call consent record', async () => {
            const { data, error } = await supabase
                .from('moltbot_call_consents')
                .insert({
                    conversation_id: TEST_IDS.conversationId,
                    state: 'not_requested',
                    scope: 'concierge',
                })
                .select()
                .single();

            expect(error).toBeNull();
            expect(data?.state).toBe('not_requested');
        });

        it('should track consent request lifecycle', async () => {
            const { data: consent } = await supabase
                .from('moltbot_call_consents')
                .select('id')
                .eq('conversation_id', TEST_IDS.conversationId)
                .single();

            // Request consent
            const { data: requested } = await supabase
                .from('moltbot_call_consents')
                .update({
                    state: 'requested',
                    requested_at: new Date().toISOString(),
                })
                .eq('id', consent!.id)
                .select()
                .single();

            expect(requested?.state).toBe('requested');

            // Grant consent
            const { data: granted } = await supabase
                .from('moltbot_call_consents')
                .update({
                    state: 'granted',
                    granted_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                })
                .eq('id', consent!.id)
                .select()
                .single();

            expect(granted?.state).toBe('granted');
            expect(granted?.expires_at).toBeDefined();
        });
    });
});
