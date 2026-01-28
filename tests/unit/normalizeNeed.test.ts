/**
 * Need Normalization Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeNeed,
    needsClarification,
    getClarificationQuestions,
    type OcrFields,
} from '../../src/taxonomy/normalizeNeed';

describe('normalizeNeed', () => {
    describe('electronics/phone_accessories detection', () => {
        it('detects iPhone case request', () => {
            const result = normalizeNeed('I need an iPhone 15 Pro case');
            expect(result.category).toBe('electronics');
            expect(result.subcategory).toBe('phone_accessories');
            expect(result.attributes.brand).toBe('Apple');
            expect(result.attributes.model).toBe('iPhone 15 Pro');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        });

        it('detects Samsung Galaxy charger', () => {
            const result = normalizeNeed('Samsung Galaxy S24 charger black');
            expect(result.category).toBe('electronics');
            expect(result.subcategory).toBe('phone_accessories');
            expect(result.attributes.brand).toBe('Samsung');
            expect(result.attributes.accessory_type).toBe('charger');
            expect(result.attributes.color).toBe('black');
        });

        it('detects generic phone case', () => {
            const result = normalizeNeed('phone case for my device');
            expect(result.category).toBe('electronics');
            expect(result.subcategory).toBe('phone_accessories');
        });

        it('extracts color attribute', () => {
            const result = normalizeNeed('iPhone case blue');
            expect(result.attributes.color).toBe('blue');
        });
    });

    describe('electronics/computers detection', () => {
        it('detects MacBook charger', () => {
            const result = normalizeNeed('MacBook charger');
            expect(result.category).toBe('electronics');
            expect(result.subcategory).toBe('computers');
            expect(result.attributes.brand).toBe('Apple');
            expect(result.attributes.type).toBe('charger');
        });

        it('detects laptop keyboard', () => {
            const result = normalizeNeed('I need a laptop keyboard');
            expect(result.category).toBe('electronics');
            expect(result.subcategory).toBe('computers');
            expect(result.attributes.type).toBe('keyboard');
        });
    });

    describe('pharmacy detection', () => {
        it('detects prescription medication', () => {
            const result = normalizeNeed('I need amoxicillin 500mg tablets');
            expect(result.category).toBe('pharmacy');
            expect(result.subcategory).toBe('prescription_meds');
            expect(result.attributes.dose).toBe('500mg');
            expect(result.attributes.form).toBe('tablets');
        });

        it('detects OTC medication', () => {
            const result = normalizeNeed('Panadol for headache');
            expect(result.category).toBe('pharmacy');
            expect(result.subcategory).toBe('otc');
        });

        it('parses prescription from OCR', () => {
            const ocrFields: OcrFields = {
                drug_names: ['Metformin'],
                prescription_details: {
                    dose: '850mg',
                    form: 'tablets',
                    quantity: '30',
                },
            };
            const result = normalizeNeed('prescription image', ocrFields);
            expect(result.category).toBe('pharmacy');
            expect(result.subcategory).toBe('prescription_meds');
            expect(result.attributes.drug_name).toBe('Metformin');
            expect(result.attributes.dose).toBe('850mg');
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        });
    });

    describe('groceries detection', () => {
        it('detects food items', () => {
            const result = normalizeNeed('I need tomatoes and rice');
            expect(result.category).toBe('groceries');
        });

        it('detects milk brand', () => {
            const result = normalizeNeed('Nido milk powder');
            expect(result.category).toBe('groceries');
        });
    });

    describe('cosmetics detection', () => {
        it('detects skincare products', () => {
            const result = normalizeNeed('I need moisturizer cream');
            expect(result.category).toBe('cosmetics');
        });

        it('detects makeup', () => {
            const result = normalizeNeed('red lipstick');
            expect(result.category).toBe('cosmetics');
        });
    });

    describe('hardware detection', () => {
        it('detects tools', () => {
            const result = normalizeNeed('I need a hammer and some nails');
            expect(result.category).toBe('hardware');
        });

        it('detects electrical items', () => {
            const result = normalizeNeed('light bulb and socket');
            expect(result.category).toBe('hardware');
        });
    });

    describe('unknown category', () => {
        it('returns unknown for unrecognized queries', () => {
            const result = normalizeNeed('xyz123 unknown product');
            expect(result.category).toBe('unknown');
            expect(result.confidence).toBeLessThan(0.5);
        });

        it('stores original text in notes', () => {
            const result = normalizeNeed('something unusual');
            expect(result.attributes.notes).toBe('something unusual');
        });
    });

    describe('query_string generation', () => {
        it('builds query from extracted attributes', () => {
            const result = normalizeNeed('iPhone 15 Pro case black');
            expect(result.query_string).toContain('Apple');
            expect(result.query_string).toContain('iPhone 15 Pro');
        });

        it('falls back to original text when no attributes', () => {
            const result = normalizeNeed('tomatoes');
            expect(result.query_string).toBe('tomatoes');
        });
    });
});

describe('needsClarification', () => {
    it('returns true for unknown category', () => {
        const need = normalizeNeed('xyz unknown');
        expect(needsClarification(need)).toBe(true);
    });

    it('returns false for high-confidence match', () => {
        const need = normalizeNeed('iPhone 15 Pro case');
        expect(needsClarification(need)).toBe(false);
    });
});

describe('getClarificationQuestions', () => {
    it('returns questions for unknown category', () => {
        const need = normalizeNeed('xyz unknown');
        const questions = getClarificationQuestions(need);
        expect(questions.length).toBeGreaterThan(0);
        expect(questions[0]).toContain('type of product');
    });

    it('asks for brand when missing in electronics', () => {
        const need = normalizeNeed('phone case');
        // Force no brand for test
        need.attributes.brand = undefined;
        const questions = getClarificationQuestions(need);
        expect(questions).toContain('What brand/model is this for?');
    });
});
