/**
 * Reply Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { parseVendorReply } from '../../src/vendor/replyParser';

describe('parseVendorReply', () => {
    describe('availability parsing', () => {
        it('detects positive numbered response', () => {
            const result = parseVendorReply('1. yes 2. 15k 3. Kimironko 4. black');
            expect(result.availability).toBe('in_stock');
        });

        it('detects negative numbered response', () => {
            const result = parseVendorReply('1. no 2. - 3. - 4. -');
            expect(result.availability).toBe('out_of_stock');
        });

        it('detects "available" keyword', () => {
            const result = parseVendorReply('Yes available, 20k at Nyabugogo');
            expect(result.availability).toBe('in_stock');
        });

        it('detects "out of stock" phrase', () => {
            const result = parseVendorReply('Sorry, out of stock');
            expect(result.availability).toBe('out_of_stock');
        });

        it('returns unclear for ambiguous messages', () => {
            const result = parseVendorReply('Let me check and get back to you');
            expect(result.availability).toBe('unclear');
        });

        it('handles Kinyarwanda positive', () => {
            const result = parseVendorReply('Niba, dufite. 15k');
            expect(result.availability).toBe('in_stock');
        });
    });

    describe('price parsing', () => {
        it('parses k notation', () => {
            const result = parseVendorReply('1. yes 2. 15k');
            expect(result.price_min).toBe(15000);
            expect(result.price_max).toBe(15000);
        });

        it('parses k range', () => {
            const result = parseVendorReply('Price is 15k-30k depending on size');
            expect(result.price_min).toBe(15000);
            expect(result.price_max).toBe(30000);
        });

        it('parses comma-formatted numbers', () => {
            const result = parseVendorReply('Price: 25,000 RWF');
            expect(result.price_min).toBe(25000);
        });

        it('parses numbered format price', () => {
            const result = parseVendorReply('1. yes 2. 18k-22k 3. Downtown');
            expect(result.price_min).toBe(18000);
            expect(result.price_max).toBe(22000);
        });
    });

    describe('location parsing', () => {
        it('extracts numbered format location', () => {
            const result = parseVendorReply('1. yes 2. 20k 3. Kimironko market 4. black');
            expect(result.location_note).toBe('Kimironko market');
        });

        it('extracts location from keyword', () => {
            const result = parseVendorReply('Available at Nyabugogo near bus stop');
            expect(result.location_note).toContain('Nyabugogo');
        });
    });

    describe('options parsing', () => {
        it('extracts numbered format options', () => {
            const result = parseVendorReply('1. yes 2. 15k 3. Town 4. black or white');
            expect(result.options).toContain('black');
            expect(result.options).toContain('white');
        });

        it('extracts "available in" options', () => {
            const result = parseVendorReply('Available in red, blue, green');
            expect(result.options).toContain('red');
            expect(result.options).toContain('blue');
            expect(result.options).toContain('green');
        });
    });

    describe('confidence scoring', () => {
        it('gives high confidence for complete response', () => {
            const result = parseVendorReply('1. yes 2. 15k-20k 3. Kimironko 4. black');
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        });

        it('gives lower confidence for unclear availability', () => {
            const result = parseVendorReply('Maybe, will check');
            expect(result.confidence).toBeLessThan(0.5);
        });

        it('gives medium confidence for partial info', () => {
            const result = parseVendorReply('Yes available 20k');
            expect(result.confidence).toBeGreaterThanOrEqual(0.6);
        });
    });
});
