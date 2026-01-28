/**
 * Shortlist Scoring Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    scoreVendorReply,
    rankCandidates,
    applyOutOfStockConstraint
} from '../../src/shortlist/scoring';
import { DEFAULT_RANK_CONFIG } from '../../src/shortlist/types';
import type { ParsedVendorReply } from '@easymo/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const createReply = (overrides: Partial<ParsedVendorReply> = {}): ParsedVendorReply => ({
    availability: 'in_stock',
    price_min: 15000,
    price_max: 20000,
    location_note: 'Kimironko Market',
    confidence: 0.8,
    ...overrides,
});

const now = new Date();
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

// =============================================================================
// Score Calculation Tests
// =============================================================================

describe('scoreVendorReply', () => {
    it('scores in_stock availability correctly', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ availability: 'in_stock' }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: true,
        });

        expect(candidate.scoring.availability_score).toBe(DEFAULT_RANK_CONFIG.availability.in_stock);
        expect(candidate.scoring.availability_score).toBe(50);
    });

    it('scores out_of_stock with negative score', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ availability: 'out_of_stock' }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: false,
        });

        expect(candidate.scoring.availability_score).toBe(-100);
    });

    it('scores unclear availability with low positive score', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ availability: 'unclear' }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: false,
        });

        expect(candidate.scoring.availability_score).toBe(10);
    });

    it('scores first responder with speed bonus', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply(),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: true,
        });

        expect(candidate.scoring.speed_score).toBe(10);
    });

    it('scores confidence correctly (confidence × 20)', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ confidence: 0.85 }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: false,
        });

        expect(candidate.scoring.confidence_score).toBe(17); // 0.85 × 20 = 17
    });

    it('scores price within budget correctly', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ price_min: 15000, price_max: 20000 }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: false,
            client_constraints: { budget_max: 25000 },
        });

        expect(candidate.scoring.price_score).toBe(20);
    });

    it('scores price slightly above budget', () => {
        const candidate = scoreVendorReply({
            vendor_id: 'v1',
            vendor_name: 'Test Vendor',
            vendor_phone: '+250788123456',
            reply: createReply({ price_min: 20000, price_max: 22000 }),
            response_received_at: fiveMinutesAgo,
            request_created_at: thirtyMinutesAgo,
            is_first_responder: false,
            client_constraints: { budget_max: 20000 },
        });

        expect(candidate.scoring.price_score).toBe(5); // slightly above
    });
});

// =============================================================================
// Ranking Tests
// =============================================================================

describe('rankCandidates', () => {
    const createCandidate = (
        id: string,
        totalScore: number,
        availability: 'in_stock' | 'out_of_stock' | 'unclear' = 'in_stock'
    ) => ({
        vendor_id: id,
        vendor_name: `Vendor ${id}`,
        vendor_phone: '+250788000000',
        reply: { availability, confidence: 0.7, price_min: 15000 } as ParsedVendorReply,
        response_received_at: fiveMinutesAgo,
        scoring: {
            availability_score: 50,
            price_score: 10,
            distance_score: 0,
            confidence_score: 14,
            speed_score: 0,
            total: totalScore,
        },
    });

    it('ranks candidates by total score descending', () => {
        const candidates = [
            createCandidate('v1', 50),
            createCandidate('v2', 80),
            createCandidate('v3', 30),
        ];

        const ranked = rankCandidates(candidates);

        expect(ranked[0].vendor_id).toBe('v2');
        expect(ranked[1].vendor_id).toBe('v1');
        expect(ranked[2].vendor_id).toBe('v3');
    });

    it('limits output to max 5 items', () => {
        const candidates = Array.from({ length: 10 }, (_, i) =>
            createCandidate(`v${i}`, 100 - i * 5)
        );

        const ranked = rankCandidates(candidates);

        expect(ranked).toHaveLength(5);
        expect(ranked[0].vendor_id).toBe('v0');
        expect(ranked[4].vendor_id).toBe('v4');
    });

    it('allows custom max items', () => {
        const candidates = Array.from({ length: 10 }, (_, i) =>
            createCandidate(`v${i}`, 100 - i * 5)
        );

        const ranked = rankCandidates(candidates, { maxItems: 3 });

        expect(ranked).toHaveLength(3);
    });
});

// =============================================================================
// Hard Constraint Tests
// =============================================================================

describe('applyOutOfStockConstraint', () => {
    const createCandidate = (
        id: string,
        availability: 'in_stock' | 'out_of_stock' | 'unclear'
    ) => ({
        vendor_id: id,
        vendor_name: `Vendor ${id}`,
        vendor_phone: '+250788000000',
        reply: { availability, confidence: 0.7 } as ParsedVendorReply,
        response_received_at: fiveMinutesAgo,
        scoring: {
            availability_score: availability === 'in_stock' ? 50 : -100,
            price_score: 10,
            distance_score: 0,
            confidence_score: 14,
            speed_score: 0,
            total: availability === 'in_stock' ? 74 : -76,
        },
    });

    it('excludes out_of_stock when alternatives exist', () => {
        const candidates = [
            createCandidate('v1', 'in_stock'),
            createCandidate('v2', 'out_of_stock'),
            createCandidate('v3', 'unclear'),
        ];

        const filtered = applyOutOfStockConstraint(candidates);

        expect(filtered).toHaveLength(2);
        expect(filtered.find(c => c.vendor_id === 'v2')).toBeUndefined();
    });

    it('keeps out_of_stock when no alternatives exist', () => {
        const candidates = [
            createCandidate('v1', 'out_of_stock'),
            createCandidate('v2', 'out_of_stock'),
        ];

        const filtered = applyOutOfStockConstraint(candidates);

        expect(filtered).toHaveLength(2);
    });

    it('handles empty input', () => {
        const filtered = applyOutOfStockConstraint([]);
        expect(filtered).toHaveLength(0);
    });
});
