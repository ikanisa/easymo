/**
 * i18n Template Tests
 *
 * Tests for template loading and rendering.
 */

import { describe, test, expect } from 'vitest';
import {
    getTemplate,
    renderTemplate,
    TEMPLATES,
    TemplateKey,
} from '../../src/i18n/templates';

describe('i18n Templates', () => {
    describe('TEMPLATES', () => {
        test('all templates have EN/FR/RW versions', () => {
            const keys = Object.keys(TEMPLATES) as TemplateKey[];
            for (const key of keys) {
                expect(TEMPLATES[key].en).toBeDefined();
                expect(TEMPLATES[key].fr).toBeDefined();
                expect(TEMPLATES[key].rw).toBeDefined();
                expect(TEMPLATES[key].en.length).toBeGreaterThan(0);
                expect(TEMPLATES[key].fr.length).toBeGreaterThan(0);
                expect(TEMPLATES[key].rw.length).toBeGreaterThan(0);
            }
        });

        test('templates are WhatsApp-friendly (not too long)', () => {
            const keys = Object.keys(TEMPLATES) as TemplateKey[];
            for (const key of keys) {
                // Most templates should be under 200 chars
                // Only shortlist_intro with placeholders might expand
                expect(TEMPLATES[key].en.length).toBeLessThan(200);
                expect(TEMPLATES[key].fr.length).toBeLessThan(200);
                expect(TEMPLATES[key].rw.length).toBeLessThan(200);
            }
        });
    });

    describe('getTemplate', () => {
        test('returns English template for en', () => {
            const result = getTemplate('processing_image', 'en');
            expect(result).toBe('Processing your image...');
        });

        test('returns French template for fr', () => {
            const result = getTemplate('processing_image', 'fr');
            expect(result).toBe('Traitement de votre image...');
        });

        test('returns Kinyarwanda template for rw', () => {
            const result = getTemplate('processing_image', 'rw');
            expect(result).toBe('Turimo gusuzuma ifoto yawe...');
        });

        test('returns empty string for unknown key', () => {
            // @ts-expect-error testing unknown key
            const result = getTemplate('unknown_key', 'en');
            expect(result).toBe('');
        });

        test('returns all consent templates correctly', () => {
            expect(getTemplate('consent_request_call', 'en')).toContain('YES or NO');
            expect(getTemplate('consent_request_call', 'fr')).toContain('OUI ou NON');
            expect(getTemplate('consent_request_call', 'rw')).toContain('YEGO cyangwa OYA');
        });
    });

    describe('renderTemplate', () => {
        test('renders template without vars', () => {
            const result = renderTemplate('processing_image', 'en');
            expect(result).toBe('Processing your image...');
        });

        test('renders template with count variable', () => {
            const result = renderTemplate('shortlist_intro', 'en', { count: 3 });
            expect(result).toBe('I found 3 options for you:');
        });

        test('renders French template with count variable', () => {
            const result = renderTemplate('shortlist_intro', 'fr', { count: 5 });
            expect(result).toBe("J'ai trouvé 5 options pour vous :");
        });

        test('renders Kinyarwanda template with count variable', () => {
            const result = renderTemplate('shortlist_intro', 'rw', { count: 2 });
            expect(result).toBe('Nabonye amahitamo 2:');
        });

        test('renders shortlist item line with multiple vars', () => {
            const result = renderTemplate('shortlist_item_line', 'en', {
                index: 1,
                vendor_name: 'Pharmacy Plus',
                price: '500 RWF',
                availability: 'In stock',
            });
            expect(result).toBe('1. Pharmacy Plus — 500 RWF — In stock');
        });

        test('renders OCR clarification with items', () => {
            const result = renderTemplate('ocr_low_confidence', 'en', {
                items: 'dosage, quantity',
            });
            expect(result).toContain('dosage, quantity');
        });

        test('handles missing vars gracefully (keeps placeholder)', () => {
            const result = renderTemplate('shortlist_intro', 'en', {});
            expect(result).toContain('{count}');
        });
    });

    describe('language consistency', () => {
        test('all languages have same template keys', () => {
            const keys = Object.keys(TEMPLATES) as TemplateKey[];
            expect(keys.length).toBeGreaterThan(10);

            for (const key of keys) {
                expect(Object.keys(TEMPLATES[key])).toEqual(['en', 'fr', 'rw']);
            }
        });

        test('shortlist templates maintain variable format across languages', () => {
            const langs: ('en' | 'fr' | 'rw')[] = ['en', 'fr', 'rw'];
            for (const lang of langs) {
                const template = TEMPLATES.shortlist_item_line[lang];
                expect(template).toContain('{index}');
                expect(template).toContain('{vendor_name}');
                expect(template).toContain('{price}');
                expect(template).toContain('{availability}');
            }
        });
    });
});
