/**
 * Shortlist WhatsApp Formatting Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    formatShortlistForWhatsApp,
    buildWaMeLink,
    isValidWaMePhone
} from '../../src/shortlist/formatForWhatsApp';
import type { ShortlistCandidate } from '../../src/shortlist/types';
import type { ParsedVendorReply } from '@easymo/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const createCandidate = (overrides: Partial<ShortlistCandidate> = {}): ShortlistCandidate => ({
    vendor_id: 'v1',
    vendor_name: 'Kigali Electronics',
    vendor_phone: '+250788123456',
    reply: {
        availability: 'in_stock',
        price_min: 15000,
        price_max: 20000,
        location_note: 'Kimironko Market',
        confidence: 0.8,
    } as ParsedVendorReply,
    response_received_at: new Date(),
    scoring: {
        availability_score: 50,
        price_score: 20,
        distance_score: 10,
        confidence_score: 16,
        speed_score: 8,
        total: 104,
    },
    location_note: 'Kimironko Market',
    ...overrides,
});

// =============================================================================
// Message Count Tests
// =============================================================================

describe('formatShortlistForWhatsApp', () => {
    it('produces at most 2 messages', () => {
        const candidates = Array.from({ length: 5 }, (_, i) =>
            createCandidate({
                vendor_id: `v${i}`,
                vendor_name: `Vendor ${i}`,
                vendor_phone: `+25078800000${i}`,
            })
        );

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.messages.length).toBeLessThanOrEqual(2);
    });

    it('limits vendors to max 5', () => {
        const candidates = Array.from({ length: 10 }, (_, i) =>
            createCandidate({
                vendor_id: `v${i}`,
                vendor_name: `Vendor ${i}`,
                vendor_phone: `+25078800000${i}`,
            })
        );

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.vendors).toHaveLength(5);
    });

    it('includes summary and closing text', () => {
        const candidates = [createCandidate()];

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.summary).toBeTruthy();
        expect(result.closing).toBeTruthy();
    });

    it('formats vendor entries with all required fields', () => {
        const candidates = [createCandidate()];

        const result = formatShortlistForWhatsApp(candidates);

        const vendor = result.vendors[0];
        expect(vendor.name).toBe('Kigali Electronics');
        expect(vendor.price_range).toContain('k');
        expect(vendor.stock_status).toBe('In stock');
        expect(vendor.location).toBe('Kimironko Market');
        expect(vendor.wa_link).toContain('wa.me');
    });

    it('supports French language', () => {
        const candidates = [createCandidate()];

        const result = formatShortlistForWhatsApp(candidates, { language: 'fr' });

        expect(result.summary).toContain('Voici');
        expect(result.vendors[0].stock_status).toBe('En stock');
    });

    it('supports Kinyarwanda language', () => {
        const candidates = [createCandidate()];

        const result = formatShortlistForWhatsApp(candidates, { language: 'rw' });

        expect(result.summary).toContain('nabonye');
        expect(result.vendors[0].stock_status).toBe('Iri');
    });
});

// =============================================================================
// wa.me Link Tests
// =============================================================================

describe('buildWaMeLink', () => {
    it('builds valid wa.me link from full E.164 number', () => {
        const link = buildWaMeLink('+250788123456');

        expect(link).toBe('https://wa.me/250788123456');
    });

    it('removes + prefix for wa.me format', () => {
        const link = buildWaMeLink('+250788123456');

        expect(link).not.toContain('+');
    });

    it('handles local number without country code', () => {
        const link = buildWaMeLink('0788123456');

        expect(link).toBe('https://wa.me/250788123456');
    });

    it('adds country code to short numbers', () => {
        const link = buildWaMeLink('788123456');

        expect(link).toBe('https://wa.me/250788123456');
    });

    it('strips non-digit characters except leading +', () => {
        const link = buildWaMeLink('+250 788 123 456');

        expect(link).toBe('https://wa.me/250788123456');
    });

    it('handles dashes and parentheses', () => {
        const link = buildWaMeLink('+250-788-123-456');

        expect(link).toBe('https://wa.me/250788123456');
    });

    it('appends message parameter when provided', () => {
        const link = buildWaMeLink('+250788123456', 'Hello!');

        expect(link).toBe('https://wa.me/250788123456?text=Hello!');
    });

    it('URL-encodes message parameter', () => {
        const link = buildWaMeLink('+250788123456', 'Hello, how are you?');

        expect(link).toContain('text=Hello%2C%20how%20are%20you%3F');
    });
});

// =============================================================================
// Phone Validation Tests
// =============================================================================

describe('isValidWaMePhone', () => {
    it('accepts valid E.164 numbers', () => {
        expect(isValidWaMePhone('+250788123456')).toBe(true);
    });

    it('accepts valid local numbers', () => {
        expect(isValidWaMePhone('0788123456')).toBe(true);
    });

    it('rejects too short numbers', () => {
        expect(isValidWaMePhone('123')).toBe(false);
    });

    it('rejects too long numbers', () => {
        expect(isValidWaMePhone('12345678901234567890')).toBe(false);
    });

    it('ignores non-digit characters for validation', () => {
        expect(isValidWaMePhone('+250 788 123 456')).toBe(true);
    });
});

// =============================================================================
// Price Formatting Tests
// =============================================================================

describe('price formatting', () => {
    it('formats prices in k notation', () => {
        const candidates = [createCandidate({
            reply: {
                availability: 'in_stock',
                price_min: 15000,
                price_max: 20000,
                confidence: 0.8,
            } as ParsedVendorReply,
        })];

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.vendors[0].price_range).toContain('15k');
        expect(result.vendors[0].price_range).toContain('20k');
    });

    it('shows Price on request when no price', () => {
        const candidates = [createCandidate({
            reply: {
                availability: 'in_stock',
                confidence: 0.8,
            } as ParsedVendorReply,
        })];

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.vendors[0].price_range).toBe('Price on request');
    });

    it('formats single price correctly', () => {
        const candidates = [createCandidate({
            reply: {
                availability: 'in_stock',
                price_min: 15000,
                confidence: 0.8,
            } as ParsedVendorReply,
        })];

        const result = formatShortlistForWhatsApp(candidates);

        expect(result.vendors[0].price_range).toBe('15k RWF');
    });
});
