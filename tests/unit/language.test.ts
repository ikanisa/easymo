/**
 * Language Detection Tests
 *
 * Tests for detectLanguage.ts and language handling.
 */

import { describe, test, expect } from 'vitest';
import {
    detectLanguage,
    parseExplicitOverride,
    shouldUpdateLanguage,
} from '../../src/i18n/detectLanguage';

describe('Language Detection', () => {
    describe('detectLanguage', () => {
        test('detects French from bonjour', () => {
            const result = detectLanguage(['Bonjour, je cherche un médicament']);
            expect(result).toBe('fr');
        });

        test('detects French from merci', () => {
            const result = detectLanguage(['Merci beaucoup']);
            expect(result).toBe('fr');
        });

        test('detects Kinyarwanda from murakoze', () => {
            const result = detectLanguage(['Murakoze cyane']);
            expect(result).toBe('rw');
        });

        test('detects Kinyarwanda from muraho', () => {
            const result = detectLanguage(['Muraho, ndashaka umuti']);
            expect(result).toBe('rw');
        });

        test('detects English from hello', () => {
            const result = detectLanguage(['Hello, I need medicine']);
            expect(result).toBe('en');
        });

        test('defaults to English for unknown language', () => {
            const result = detectLanguage(['xyz abc 123']);
            expect(result).toBe('en');
        });

        test('handles multiple messages', () => {
            const result = detectLanguage([
                'First message',
                'Bonjour',
                'Je voudrais acheter',
            ]);
            expect(result).toBe('fr');
        });

        test('detects explicit override in messages', () => {
            const result = detectLanguage(['Kinyarwanda']);
            expect(result).toBe('rw');
        });

        test('handles empty messages', () => {
            const result = detectLanguage([]);
            expect(result).toBe('en');
        });

        test('Kinyarwanda wins over French if more markers', () => {
            const result = detectLanguage(['Muraho, murakoze, yego, ndashaka']);
            expect(result).toBe('rw');
        });
    });

    describe('parseExplicitOverride', () => {
        test('parses "English" override', () => {
            expect(parseExplicitOverride('English')).toBe('en');
        });

        test('parses "EN" override (case-insensitive)', () => {
            expect(parseExplicitOverride('en')).toBe('en');
            expect(parseExplicitOverride('EN')).toBe('en');
        });

        test('parses "Français" override', () => {
            expect(parseExplicitOverride('Français')).toBe('fr');
        });

        test('parses "French" override', () => {
            expect(parseExplicitOverride('French')).toBe('fr');
        });

        test('parses "FR" override', () => {
            expect(parseExplicitOverride('fr')).toBe('fr');
        });

        test('parses "Kinyarwanda" override', () => {
            expect(parseExplicitOverride('Kinyarwanda')).toBe('rw');
        });

        test('parses "Ikinyarwanda" override', () => {
            expect(parseExplicitOverride('Ikinyarwanda')).toBe('rw');
        });

        test('parses "RW" override', () => {
            expect(parseExplicitOverride('RW')).toBe('rw');
            expect(parseExplicitOverride('rw')).toBe('rw');
        });

        test('returns null for non-override text', () => {
            expect(parseExplicitOverride('Hello world')).toBeNull();
            expect(parseExplicitOverride('I need medicine')).toBeNull();
        });

        test('handles trimming', () => {
            expect(parseExplicitOverride('  English  ')).toBe('en');
        });
    });

    describe('shouldUpdateLanguage', () => {
        test('returns shouldUpdate=true for explicit override', () => {
            const result = shouldUpdateLanguage('en', 'Français');
            expect(result.shouldUpdate).toBe(true);
            expect(result.newLanguage).toBe('fr');
        });

        test('returns shouldUpdate=false for same language', () => {
            const result = shouldUpdateLanguage('fr', 'Français');
            expect(result.shouldUpdate).toBe(false);
            expect(result.newLanguage).toBe('fr');
        });

        test('returns shouldUpdate=false for non-override text', () => {
            const result = shouldUpdateLanguage('en', 'Hello world');
            expect(result.shouldUpdate).toBe(false);
            expect(result.newLanguage).toBe('en');
        });
    });
});
