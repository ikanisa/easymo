/**
 * OCR Extract Unit Tests
 * 
 * Tests for schema validation, confidence scoring, and extraction logic.
 */

import { describe, it, expect } from 'vitest';
import {
    OcrOutputSchema,
    MedicalPrescriptionFieldsSchema,
    GeneralDocumentFieldsSchema,
    ConfidenceSchema,
    OcrWarning,
    hasDrugNameUncertainty,
    calculateMedicalConfidence,
    type MedicalPrescriptionFields,
} from '@insure/ocr-extract';

// Test fixtures
import prescriptionHighConf from '../fixtures/ocr/prescription-high-confidence.json';
import prescriptionLowConf from '../fixtures/ocr/prescription-low-confidence.json';
import invoiceSample from '../fixtures/ocr/invoice-sample.json';
import productPhoto from '../fixtures/ocr/product-photo.json';

describe('OCR Schemas', () => {
    describe('OcrOutputSchema', () => {
        it('validates high confidence prescription', () => {
            const result = OcrOutputSchema.safeParse(prescriptionHighConf);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.meta.ocr_type).toBe('medical_prescription');
                expect(result.data.confidence.overall).toBeGreaterThan(0.9);
                expect(result.data.warnings).toHaveLength(0);
            }
        });

        it('validates low confidence prescription with warnings', () => {
            const result = OcrOutputSchema.safeParse(prescriptionLowConf);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.warnings).toContain('uncertain_drug_name');
                expect(result.data.confidence.overall).toBeLessThan(0.75);
            }
        });

        it('validates general document (invoice)', () => {
            const result = OcrOutputSchema.safeParse(invoiceSample);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.meta.ocr_type).toBe('general_document_or_photo');
            }
        });

        it('validates product photo extraction', () => {
            const result = OcrOutputSchema.safeParse(productPhoto);
            expect(result.success).toBe(true);
            if (result.success) {
                const fields = result.data.extracted.fields as {
                    brands?: string[];
                    phone_numbers?: string[];
                };
                expect(fields.brands).toContain('Toyota');
                expect(fields.phone_numbers).toContain('+250 788 123 456');
            }
        });
    });

    describe('MedicalPrescriptionFieldsSchema', () => {
        it('validates complete prescription fields', () => {
            const fields = {
                patient_name: 'John Doe',
                prescriber_name: 'Dr. Smith',
                facility: 'City Hospital',
                date: '2026-01-28',
                items: [
                    {
                        drug_name: 'Amoxicillin',
                        dose: '500mg',
                        form: 'capsule',
                        quantity: 21,
                        instructions: 'Take 3 times daily',
                    },
                ],
            };

            const result = MedicalPrescriptionFieldsSchema.safeParse(fields);
            expect(result.success).toBe(true);
        });

        it('allows optional fields to be null', () => {
            const fields = {
                patient_name: null,
                prescriber_name: null,
                facility: null,
                date: null,
                items: [],
            };

            const result = MedicalPrescriptionFieldsSchema.safeParse(fields);
            expect(result.success).toBe(true);
        });
    });

    describe('GeneralDocumentFieldsSchema', () => {
        it('validates product extraction fields', () => {
            const fields = {
                product_keywords: ['phone', 'smartphone'],
                brands: ['Samsung'],
                models: ['Galaxy S24'],
                colors: ['black'],
                quantities: ['1'],
                addresses_or_landmarks: ['Kigali'],
                phone_numbers: ['+250788000000'],
                notes: 'New condition',
            };

            const result = GeneralDocumentFieldsSchema.safeParse(fields);
            expect(result.success).toBe(true);
        });

        it('provides defaults for missing arrays', () => {
            const fields = {};
            const result = GeneralDocumentFieldsSchema.safeParse(fields);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.product_keywords).toEqual([]);
                expect(result.data.brands).toEqual([]);
            }
        });
    });

    describe('ConfidenceSchema', () => {
        it('validates confidence with per-field scores', () => {
            const confidence = {
                overall: 0.85,
                text_full: 0.90,
                fields: {
                    patient_name: 0.80,
                    drug_name: 0.92,
                },
            };

            const result = ConfidenceSchema.safeParse(confidence);
            expect(result.success).toBe(true);
        });

        it('rejects confidence outside 0-1 range', () => {
            const confidence = {
                overall: 1.5,
            };

            const result = ConfidenceSchema.safeParse(confidence);
            expect(result.success).toBe(false);
        });
    });

    describe('OcrWarning enum', () => {
        it('accepts valid warning values', () => {
            expect(OcrWarning.safeParse('uncertain_drug_name').success).toBe(true);
            expect(OcrWarning.safeParse('low_image_quality').success).toBe(true);
        });

        it('rejects invalid warning values', () => {
            expect(OcrWarning.safeParse('invalid_warning').success).toBe(false);
        });
    });
});

describe('Confidence Helpers', () => {
    describe('hasDrugNameUncertainty', () => {
        it('returns true when drug confidence below threshold', () => {
            const fields: MedicalPrescriptionFields = {
                items: [{ drug_name: 'Amoxicillin' }],
            };
            const confidenceFields = {
                items: [{ drug_name: 0.6 }],
            };

            expect(hasDrugNameUncertainty(fields, confidenceFields, 0.75)).toBe(true);
        });

        it('returns false when drug confidence above threshold', () => {
            const fields: MedicalPrescriptionFields = {
                items: [{ drug_name: 'Amoxicillin' }],
            };
            const confidenceFields = {
                items: [{ drug_name: 0.9 }],
            };

            expect(hasDrugNameUncertainty(fields, confidenceFields, 0.75)).toBe(false);
        });

        it('handles missing confidence fields gracefully', () => {
            const fields: MedicalPrescriptionFields = {
                items: [{ drug_name: 'Amoxicillin' }],
            };

            expect(hasDrugNameUncertainty(fields, undefined, 0.75)).toBe(false);
            expect(hasDrugNameUncertainty(fields, {}, 0.75)).toBe(false);
        });
    });

    describe('calculateMedicalConfidence', () => {
        it('calculates weighted confidence for prescription', () => {
            const fieldConfidences = {
                patient_name: 0.9,
                prescriber_name: 0.9,
                facility: 0.8,
                date: 0.95,
                items: [
                    { drug_name: 0.92, dose: 0.88 },
                    { drug_name: 0.95, dose: 0.90 },
                ],
            };

            const result = calculateMedicalConfidence(fieldConfidences);
            expect(result).toBeGreaterThan(0.8);
            expect(result).toBeLessThan(1.0);
        });

        it('heavily weights drug name confidence', () => {
            const lowDrugConfidence = {
                patient_name: 0.9,
                items: [{ drug_name: 0.5, dose: 0.9 }],
            };

            const highDrugConfidence = {
                patient_name: 0.9,
                items: [{ drug_name: 0.95, dose: 0.9 }],
            };

            const lowResult = calculateMedicalConfidence(lowDrugConfidence);
            const highResult = calculateMedicalConfidence(highDrugConfidence);

            expect(highResult).toBeGreaterThan(lowResult);
        });
    });
});
