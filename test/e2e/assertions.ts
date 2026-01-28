/**
 * E2E Test Assertions
 * 
 * Helper functions for asserting Moltbot conversation state and behavior.
 */

import { expect } from 'vitest';
import type { MoltbotRequestState, MoltbotShortlistItem } from '@easymo/types';

// =============================================================================
// Types
// =============================================================================

export interface MockSupabaseClient {
    from(table: string): MockQueryBuilder;
}

export interface MockQueryBuilder {
    select(columns?: string): MockQueryBuilder;
    eq(column: string, value: unknown): MockQueryBuilder;
    neq(column: string, value: unknown): MockQueryBuilder;
    single(): Promise<{ data: unknown; error: unknown }>;
    then(resolve: (result: { data: unknown[]; error: unknown }) => void): Promise<void>;
}

// =============================================================================
// State Assertions
// =============================================================================

/**
 * Assert that a marketplace request is in the expected state
 */
export async function assertRequestState(
    supabase: MockSupabaseClient,
    requestId: string,
    expectedState: MoltbotRequestState,
): Promise<void> {
    const { data, error } = await supabase
        .from('moltbot_marketplace_requests')
        .select('state')
        .eq('id', requestId)
        .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect((data as { state: string }).state).toBe(expectedState);
}

/**
 * Assert no duplicate vendor outreach exists for a request
 */
export async function assertNoDuplicateVendorOutreach(
    supabase: MockSupabaseClient,
    requestId: string,
): Promise<void> {
    const rows: Array<{ vendor_id: string }> = [];

    await supabase
        .from('moltbot_vendor_outreach')
        .select('vendor_id')
        .eq('request_id', requestId)
        .then(result => {
            if (result.data) {
                rows.push(...(result.data as Array<{ vendor_id: string }>));
            }
        });

    const vendorIds = rows.map(r => r.vendor_id);
    const uniqueIds = new Set(vendorIds);

    expect(vendorIds.length).toBe(uniqueIds.size);
}

/**
 * Assert that a specific vendor outreach count exists
 */
export async function assertVendorOutreachCount(
    supabase: MockSupabaseClient,
    requestId: string,
    expectedCount: number,
): Promise<void> {
    const rows: unknown[] = [];

    await supabase
        .from('moltbot_vendor_outreach')
        .select('id')
        .eq('request_id', requestId)
        .then(result => {
            if (result.data) {
                rows.push(...(result.data as unknown[]));
            }
        });

    expect(rows.length).toBe(expectedCount);
}

// =============================================================================
// Message Assertions
// =============================================================================

/**
 * Assert that outbound messages contain a specific substring
 */
export function assertOutboundContains(
    outboundMessages: Array<{ content: unknown }>,
    substring: string,
): void {
    const found = outboundMessages.some(msg => {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        return content.includes(substring);
    });

    expect(found).toBe(true);
}

/**
 * Assert that outbound messages do NOT contain a specific substring
 */
export function assertOutboundDoesNotContain(
    outboundMessages: Array<{ content: unknown }>,
    substring: string,
): void {
    const found = outboundMessages.some(msg => {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        return content.includes(substring);
    });

    expect(found).toBe(false);
}

/**
 * Assert that a message was sent to a specific recipient
 */
export function assertMessageSentTo(
    outboundMessages: Array<{ to: string; content: unknown }>,
    recipient: string,
): void {
    const found = outboundMessages.some(msg => msg.to === recipient);
    expect(found).toBe(true);
}

// =============================================================================
// Shortlist Assertions
// =============================================================================

/**
 * Assert that shortlist has expected number of wa.me links
 */
export function assertShortlistHasWaMeLinks(
    outboundMessages: Array<{ content: unknown }>,
    expectedCount: number,
): void {
    let totalLinks = 0;

    for (const msg of outboundMessages) {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        const matches = content.match(/wa\.me\/\d+/g);
        totalLinks += matches?.length ?? 0;
    }

    expect(totalLinks).toBe(expectedCount);
}

/**
 * Assert shortlist items are valid and have required fields
 */
export function assertValidShortlist(
    items: MoltbotShortlistItem[],
    minItems: number = 1,
    maxItems: number = 5,
): void {
    expect(items.length).toBeGreaterThanOrEqual(minItems);
    expect(items.length).toBeLessThanOrEqual(maxItems);

    for (const item of items) {
        expect(item.vendor_id).toBeDefined();
        expect(item.vendor_name).toBeDefined();
        expect(item.vendor_phone).toBeDefined();
        expect(item.response_summary).toBeDefined();
    }
}

// =============================================================================
// OCR Assertions
// =============================================================================

/**
 * Assert OCR job completed with expected confidence
 */
export async function assertOcrJobCompleted(
    supabase: MockSupabaseClient,
    jobId: string,
    minConfidence: number = 0.5,
): Promise<void> {
    const { data, error } = await supabase
        .from('moltbot_ocr_jobs')
        .select('status, confidence')
        .eq('id', jobId)
        .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const job = data as { status: string; confidence: number };
    expect(job.status).toBe('completed');
    expect(job.confidence).toBeGreaterThanOrEqual(minConfidence);
}

/**
 * Assert OCR job failed with error message
 */
export async function assertOcrJobFailed(
    supabase: MockSupabaseClient,
    jobId: string,
): Promise<void> {
    const { data, error } = await supabase
        .from('moltbot_ocr_jobs')
        .select('status, error_message')
        .eq('id', jobId)
        .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const job = data as { status: string; error_message: string | null };
    expect(job.status).toBe('failed');
    expect(job.error_message).toBeDefined();
}

// =============================================================================
// Calling Assertions
// =============================================================================

/**
 * Assert call consent is in expected state
 */
export async function assertCallConsentState(
    supabase: MockSupabaseClient,
    consentId: string,
    expectedState: 'not_requested' | 'requested' | 'granted' | 'denied' | 'expired',
): Promise<void> {
    const { data, error } = await supabase
        .from('moltbot_call_consents')
        .select('state')
        .eq('id', consentId)
        .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect((data as { state: string }).state).toBe(expectedState);
}

/**
 * Assert no call was initiated (for consent denial cases)
 */
export async function assertNoCallInitiated(
    supabase: MockSupabaseClient,
    consentId: string,
): Promise<void> {
    const rows: unknown[] = [];

    await supabase
        .from('moltbot_call_attempts')
        .select('id')
        .eq('consent_id', consentId)
        .then(result => {
            if (result.data) {
                rows.push(...(result.data as unknown[]));
            }
        });

    expect(rows.length).toBe(0);
}

// =============================================================================
// Idempotency Assertions
// =============================================================================

/**
 * Assert that a message was only processed once (idempotency check)
 */
export async function assertSingleMessageProcessing(
    supabase: MockSupabaseClient,
    messageId: string,
): Promise<void> {
    const rows: unknown[] = [];

    await supabase
        .from('moltbot_conversation_messages')
        .select('id')
        .eq('provider_message_id', messageId)
        .then(result => {
            if (result.data) {
                rows.push(...(result.data as unknown[]));
            }
        });

    expect(rows.length).toBe(1);
}

// =============================================================================
// Security Assertions
// =============================================================================

/**
 * Assert vendor injection attempt was flagged in audit log
 */
export async function assertInjectionFlagged(
    supabase: MockSupabaseClient,
    vendorId: string,
): Promise<void> {
    const rows: unknown[] = [];

    await supabase
        .from('moltbot_audit_events')
        .select('event_type, metadata')
        .eq('actor_id', vendorId)
        .then(result => {
            if (result.data) {
                rows.push(...(result.data as unknown[]));
            }
        });

    const flagged = rows.some((row: any) =>
        row.event_type === 'security_flag' ||
        row.metadata?.injection_detected === true
    );

    expect(flagged).toBe(true);
}

/**
 * Assert no PII is present in outbound messages
 */
export function assertNoPiiInMessages(
    outboundMessages: Array<{ content: unknown }>,
    piiPatterns: RegExp[] = [
        /\b\d{10,}\b/, // Phone numbers
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
    ],
): void {
    for (const msg of outboundMessages) {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);

        for (const pattern of piiPatterns) {
            expect(pattern.test(content)).toBe(false);
        }
    }
}
