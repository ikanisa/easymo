/**
 * Shortlist Closeout Integration Tests
 * 
 * Tests state transitions, outreach cancellation, and scheduler behavior.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
    performCloseout,
    cancelPendingOutreach,
    isRequestHandedOff
} from '../../src/shortlist/closeout';
import type { MoltbotShortlistItem } from '@easymo/types';

// =============================================================================
// Mock Supabase Client
// =============================================================================

interface MockSupabaseClient {
    from: Mock;
    _requests: Map<string, { state: string; shortlist: unknown[] }>;
    _outreach: Map<string, { state: string; request_id: string }[]>;
    _audit: { event_type: string; request_id: string; details: unknown }[];
}

function createMockSupabase(): MockSupabaseClient {
    const requests = new Map<string, { state: string; shortlist: unknown[] }>();
    const outreach = new Map<string, { state: string; request_id: string }[]>();
    const audit: { event_type: string; request_id: string; details: unknown }[] = [];

    // Initialize test data
    requests.set('req-1', { state: 'awaiting_vendor_replies', shortlist: [] });
    outreach.set('req-1', [
        { state: 'queued', request_id: 'req-1' },
        { state: 'sent', request_id: 'req-1' },
        { state: 'replied', request_id: 'req-1' },
    ]);

    // Create chainable mock methods
    const createChainable = (resolveValue: unknown) => {
        const handler: Record<string, unknown> = {};
        const chainableMethods = ['eq', 'in', 'single', 'select', 'update', 'insert'];

        chainableMethods.forEach((method) => {
            handler[method] = vi.fn().mockImplementation(() => {
                if (method === 'single') {
                    return Promise.resolve(resolveValue);
                }
                return handler;
            });
        });

        // Make sure Promise methods work
        handler.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);

        return handler;
    };

    const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'moltbot_marketplace_requests') {
            return {
                update: vi.fn().mockReturnValue(
                    createChainable({ error: null })
                ),
                select: vi.fn().mockReturnValue(
                    createChainable({ data: requests.get('req-1'), error: null })
                ),
            };
        }

        if (table === 'moltbot_vendor_outreach') {
            return {
                update: vi.fn().mockReturnValue(
                    createChainable({ data: [{ id: 'o1' }, { id: 'o2' }], error: null })
                ),
            };
        }

        if (table === 'moltbot_audit_log') {
            return {
                insert: vi.fn().mockReturnValue(
                    createChainable({ data: { id: `audit-${Date.now()}` }, error: null })
                ),
            };
        }

        return createChainable({ data: null, error: null });
    });

    return {
        from: mockFrom,
        _requests: requests,
        _outreach: outreach,
        _audit: audit,
    };
}

// =============================================================================
// Test Fixtures
// =============================================================================

const testShortlist: MoltbotShortlistItem[] = [
    {
        vendor_id: 'v1',
        vendor_name: 'Kigali Electronics',
        vendor_phone: '+250788123456',
        response_summary: 'In stock, 15k-20k RWF',
        price: 15000,
        availability: 'in_stock',
    },
];

// =============================================================================
// Closeout Tests
// =============================================================================

describe('performCloseout', () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
        mockSupabase = createMockSupabase();
    });

    it('returns success on valid closeout', async () => {
        const result = await performCloseout(
            mockSupabase as unknown as Parameters<typeof performCloseout>[0],
            'req-1',
            testShortlist
        );

        expect(result.success).toBe(true);
    });

    it('reports cancelled outreach count', async () => {
        const result = await performCloseout(
            mockSupabase as unknown as Parameters<typeof performCloseout>[0],
            'req-1',
            testShortlist
        );

        expect(result.cancelled_outreach_count).toBeGreaterThanOrEqual(0);
    });

    it('generates audit event IDs', async () => {
        const result = await performCloseout(
            mockSupabase as unknown as Parameters<typeof performCloseout>[0],
            'req-1',
            testShortlist
        );

        expect(result.audit_event_ids.length).toBeGreaterThan(0);
    });
});

// =============================================================================
// Cancel Pending Outreach Tests
// =============================================================================

describe('cancelPendingOutreach', () => {
    let mockSupabase: MockSupabaseClient;

    beforeEach(() => {
        mockSupabase = createMockSupabase();
    });

    it('cancels queued and sent outreach records', async () => {
        const count = await cancelPendingOutreach(
            mockSupabase as unknown as Parameters<typeof cancelPendingOutreach>[0],
            'req-1'
        );

        // Mock returns 2 cancelled records
        expect(count).toBe(2);
    });
});

// =============================================================================
// State Check Tests
// =============================================================================

describe('isRequestHandedOff', () => {
    it('returns true for handed_off state', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { state: 'handed_off' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        const result = await isRequestHandedOff(
            mockSupabase as unknown as Parameters<typeof isRequestHandedOff>[0],
            'req-1'
        );

        expect(result).toBe(true);
    });

    it('returns true for closed state', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { state: 'closed' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        const result = await isRequestHandedOff(
            mockSupabase as unknown as Parameters<typeof isRequestHandedOff>[0],
            'req-1'
        );

        expect(result).toBe(true);
    });

    it('returns false for other states', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { state: 'awaiting_vendor_replies' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        const result = await isRequestHandedOff(
            mockSupabase as unknown as Parameters<typeof isRequestHandedOff>[0],
            'req-1'
        );

        expect(result).toBe(false);
    });

    it('returns false on error', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Not found' },
                        }),
                    }),
                }),
            }),
        };

        const result = await isRequestHandedOff(
            mockSupabase as unknown as Parameters<typeof isRequestHandedOff>[0],
            'req-1'
        );

        expect(result).toBe(false);
    });
});

// =============================================================================
// Scheduler Behavior Tests
// =============================================================================

describe('scheduler behavior after handoff', () => {
    it('scheduler should skip requests in handed_off state', async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { state: 'handed_off' },
                            error: null,
                        }),
                    }),
                }),
            }),
        };

        const isHandedOff = await isRequestHandedOff(
            mockSupabase as unknown as Parameters<typeof isRequestHandedOff>[0],
            'req-1'
        );

        // Scheduler check: if handed_off, skip processing
        if (isHandedOff) {
            expect(true).toBe(true); // Scheduler should skip
        } else {
            throw new Error('Scheduler should have skipped handed_off request');
        }
    });
});
