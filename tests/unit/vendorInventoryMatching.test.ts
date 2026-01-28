/**
 * Vendor Inventory Matching Unit Tests
 * 
 * Tests for selectVendorsWithInventory function.
 * Focuses on inventory RPC matching logic; fallback tests require more complex mocks.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
    selectVendorsWithInventory,
    type InventorySelectionParams,
} from '../../src/vendor/vendorSelector';

// =============================================================================
// Mocks
// =============================================================================

function createInventoryMock(options: {
    inventoryResults?: Array<{
        vendor_id: string;
        vendor_name: string;
        vendor_phone: string;
        match_type: string;
        match_score: number;
        price_min?: number;
        price_max?: number;
    }>;
    inventoryError?: Error;
}): SupabaseClient {
    const mockRpc = vi.fn().mockResolvedValue({
        data: options.inventoryResults || [],
        error: options.inventoryError || null,
    });

    // Minimal from mock for single vendor lookup (distance enrichment)
    const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
        }),
    });

    return {
        rpc: mockRpc,
        from: mockFrom,
    } as unknown as SupabaseClient;
}

// =============================================================================
// Tests
// =============================================================================

describe('selectVendorsWithInventory', () => {
    const baseParams: InventorySelectionParams = {
        request_id: 'req-123',
        category: 'electronics',
        subcategory: 'phone_accessories',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        limit: 10,
    };

    describe('inventory matching priority', () => {
        it('returns exact-matched vendors first', async () => {
            const mockSupabase = createInventoryMock({
                inventoryResults: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Exact Match Shop',
                        vendor_phone: '+250780000001',
                        match_type: 'exact',
                        match_score: 100,
                        price_min: 15000,
                        price_max: 30000,
                    },
                    {
                        vendor_id: 'v2',
                        vendor_name: 'Brand Match Shop',
                        vendor_phone: '+250780000002',
                        match_type: 'brand',
                        match_score: 80,
                    },
                    {
                        vendor_id: 'v3',
                        vendor_name: 'Category Shop',
                        vendor_phone: '+250780000003',
                        match_type: 'category',
                        match_score: 30,
                    },
                ],
            });

            const result = await selectVendorsWithInventory(mockSupabase, baseParams);

            expect(result.length).toBe(3);
            expect(result[0].vendor_id).toBe('v1');
            expect(result[0].match_type).toBe('exact');
            expect(result[1].vendor_id).toBe('v2');
            expect(result[1].match_type).toBe('brand');
        });

        it('assigns correct match scores by type with boost', async () => {
            const mockSupabase = createInventoryMock({
                inventoryResults: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Exact',
                        vendor_phone: '+250780000001',
                        match_type: 'exact',
                        match_score: 100,
                    },
                    {
                        vendor_id: 'v2',
                        vendor_name: 'Brand',
                        vendor_phone: '+250780000002',
                        match_type: 'brand',
                        match_score: 80,
                    },
                    {
                        vendor_id: 'v3',
                        vendor_name: 'Tag',
                        vendor_phone: '+250780000003',
                        match_type: 'tag',
                        match_score: 70,
                    },
                ],
            });

            const result = await selectVendorsWithInventory(mockSupabase, baseParams);

            // INVENTORY_MATCH_BOOST = 30, distance adjustment = 15 (default)
            expect(result[0].match_score).toBe(100 + 30 + 15);  // 145
            expect(result[1].match_score).toBe(80 + 30 + 15);   // 125
            expect(result[2].match_score).toBe(70 + 30 + 15);   // 115
        });
    });

    describe('vendor filtering', () => {
        // Note: Tests use 4 vendors so after excluding 1, we have 3 remaining (>= MIN_INVENTORY_MATCHES)
        // This avoids triggering the supplementWithCategoryVendors fallback which needs complex mocks

        it('excludes blocked vendor IDs', async () => {
            const mockSupabase = createInventoryMock({
                inventoryResults: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Blocked Vendor',
                        vendor_phone: '+250780000001',
                        match_type: 'exact',
                        match_score: 100,
                    },
                    {
                        vendor_id: 'v2',
                        vendor_name: 'Good Vendor',
                        vendor_phone: '+250780000002',
                        match_type: 'exact',
                        match_score: 90,
                    },
                    {
                        vendor_id: 'v3',
                        vendor_name: 'Another Good',
                        vendor_phone: '+250780000003',
                        match_type: 'brand',
                        match_score: 80,
                    },
                    {
                        vendor_id: 'v4',
                        vendor_name: 'Fourth Good',
                        vendor_phone: '+250780000004',
                        match_type: 'tag',
                        match_score: 70,
                    },
                ],
            });

            const result = await selectVendorsWithInventory(mockSupabase, {
                ...baseParams,
                blocked_vendor_ids: ['v1'],
            });

            expect(result.some(v => v.vendor_id === 'v1')).toBe(false);
            expect(result.some(v => v.vendor_id === 'v2')).toBe(true);
            expect(result.some(v => v.vendor_id === 'v3')).toBe(true);
            expect(result.length).toBe(3);
        });

        it('excludes already contacted vendor IDs', async () => {
            const mockSupabase = createInventoryMock({
                inventoryResults: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Already Contacted',
                        vendor_phone: '+250780000001',
                        match_type: 'exact',
                        match_score: 100,
                    },
                    {
                        vendor_id: 'v2',
                        vendor_name: 'Fresh Vendor',
                        vendor_phone: '+250780000002',
                        match_type: 'brand',
                        match_score: 80,
                    },
                    {
                        vendor_id: 'v3',
                        vendor_name: 'Another Fresh',
                        vendor_phone: '+250780000003',
                        match_type: 'tag',
                        match_score: 70,
                    },
                    {
                        vendor_id: 'v4',
                        vendor_name: 'Fourth Fresh',
                        vendor_phone: '+250780000004',
                        match_type: 'subcategory',
                        match_score: 60,
                    },
                ],
            });

            const result = await selectVendorsWithInventory(mockSupabase, {
                ...baseParams,
                already_contacted_ids: ['v1'],
            });

            expect(result.some(v => v.vendor_id === 'v1')).toBe(false);
            expect(result.some(v => v.vendor_id === 'v2')).toBe(true);
            expect(result.some(v => v.vendor_id === 'v3')).toBe(true);
            expect(result.length).toBe(3);
        });
    });

    describe('limit enforcement', () => {
        it('respects hard cap of 15 vendors', async () => {
            const manyVendors = Array.from({ length: 20 }, (_, i) => ({
                vendor_id: `v${i}`,
                vendor_name: `Vendor ${i}`,
                vendor_phone: `+25078000000${i}`,
                match_type: 'category' as const,
                match_score: 50,
            }));

            const mockSupabase = createInventoryMock({
                inventoryResults: manyVendors,
            });

            const result = await selectVendorsWithInventory(mockSupabase, {
                ...baseParams,
                limit: 20, // Request more than max
            });

            expect(result.length).toBeLessThanOrEqual(15);
        });

        it('respects requested limit when below max', async () => {
            const vendors = Array.from({ length: 10 }, (_, i) => ({
                vendor_id: `v${i}`,
                vendor_name: `Vendor ${i}`,
                vendor_phone: `+25078000000${i}`,
                match_type: 'category' as const,
                match_score: 50,
            }));

            const mockSupabase = createInventoryMock({
                inventoryResults: vendors,
            });

            const result = await selectVendorsWithInventory(mockSupabase, {
                ...baseParams,
                limit: 5,
            });

            expect(result.length).toBeLessThanOrEqual(5);
        });
    });

    describe('price range inclusion', () => {
        it('includes price range from inventory tags', async () => {
            const mockSupabase = createInventoryMock({
                inventoryResults: [
                    {
                        vendor_id: 'v1',
                        vendor_name: 'Priced Vendor',
                        vendor_phone: '+250780000001',
                        match_type: 'exact',
                        match_score: 100,
                        price_min: 15000,
                        price_max: 30000,
                    },
                    {
                        vendor_id: 'v2',
                        vendor_name: 'Another Vendor',
                        vendor_phone: '+250780000002',
                        match_type: 'brand',
                        match_score: 80,
                    },
                    {
                        vendor_id: 'v3',
                        vendor_name: 'Third Vendor',
                        vendor_phone: '+250780000003',
                        match_type: 'tag',
                        match_score: 70,
                    },
                ],
            });

            const result = await selectVendorsWithInventory(mockSupabase, baseParams);

            expect(result[0].price_min).toBe(15000);
            expect(result[0].price_max).toBe(30000);
        });
    });
});
