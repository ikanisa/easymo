/**
 * Gemini OCR Mock
 * 
 * Mock adapter for simulating Gemini-based OCR processing.
 * Returns canned OCR outputs for prescription/document fixtures.
 */

import type { GeminiOcrMockAdapter, OcrResult } from '../e2e/scenario-runner';

// =============================================================================
// Types
// =============================================================================

export interface OcrFixture {
    id: string;
    type: 'prescription' | 'invoice' | 'document' | 'product_photo';
    extracted: Record<string, unknown>;
    confidence: number;
    rawResponse?: Record<string, unknown>;
}

export interface GeminiOcrMockConfig {
    defaultConfidence?: number;
    processingDelayMs?: number;
}

// =============================================================================
// Gemini OCR Mock Implementation
// =============================================================================

export class GeminiOcrMock implements GeminiOcrMockAdapter {
    private results: Map<string, OcrResult> = new Map();
    private fixtures: Map<string, OcrFixture> = new Map();
    private processedJobs: Set<string> = new Set();

    constructor(private config: GeminiOcrMockConfig = {}) {
        this.initializeDefaultFixtures();
    }

    // ==========================================================================
    // GeminiOcrMockAdapter Interface
    // ==========================================================================

    setResult(jobId: string, result: OcrResult): void {
        this.results.set(jobId, result);
    }

    async processJob(jobId: string): Promise<OcrResult> {
        // Check if we have a preset result
        const preset = this.results.get(jobId);
        if (preset) {
            this.processedJobs.add(jobId);
            return preset;
        }

        // Simulate processing delay
        if (this.config.processingDelayMs) {
            await new Promise(resolve => setTimeout(resolve, this.config.processingDelayMs));
        }

        // Return default success result
        this.processedJobs.add(jobId);
        return {
            ocr_job_id: jobId,
            status: 'completed',
            extracted: {},
            confidence: this.config.defaultConfidence ?? 0.9,
        };
    }

    reset(): void {
        this.results.clear();
        this.processedJobs.clear();
    }

    // ==========================================================================
    // Fixture Management
    // ==========================================================================

    private initializeDefaultFixtures(): void {
        // High confidence prescription
        this.fixtures.set('prescription_high', {
            id: 'prescription_high',
            type: 'prescription',
            extracted: {
                patient_name: 'Jean Bosco',
                medications: [
                    { name: 'Amoxicillin 500mg', quantity: 21, dosage: '3x daily' },
                    { name: 'Paracetamol 500mg', quantity: 14, dosage: '2x daily' },
                ],
                doctor_name: 'Dr. Uwimana',
                hospital: 'King Faisal Hospital',
                date: '2026-01-15',
                notes: 'Take with food',
            },
            confidence: 0.95,
        });

        // Low confidence prescription (blurry/partial)
        this.fixtures.set('prescription_low', {
            id: 'prescription_low',
            type: 'prescription',
            extracted: {
                patient_name: 'J??? B???',
                medications: [
                    { name: 'Amox???', quantity: null, dosage: '??? daily' },
                ],
                doctor_name: null,
                hospital: 'King ???',
                date: null,
            },
            confidence: 0.45,
        });

        // Invoice
        this.fixtures.set('invoice', {
            id: 'invoice',
            type: 'invoice',
            extracted: {
                vendor_name: 'Pharmacy Plus',
                items: [
                    { name: 'Medicine A', price: 5000, quantity: 1 },
                    { name: 'Medicine B', price: 3000, quantity: 2 },
                ],
                total: 11000,
                currency: 'RWF',
                date: '2026-01-20',
            },
            confidence: 0.88,
        });

        // Product photo
        this.fixtures.set('product_photo', {
            id: 'product_photo',
            type: 'product_photo',
            extracted: {
                product_type: 'phone_case',
                brand: 'Samsung',
                model: 'Galaxy S24',
                color: 'Black',
                material: 'Silicone',
            },
            confidence: 0.82,
        });
    }

    /**
     * Get a fixture by ID
     */
    getFixture(fixtureId: string): OcrFixture | undefined {
        return this.fixtures.get(fixtureId);
    }

    /**
     * Add a custom fixture
     */
    addFixture(fixture: OcrFixture): void {
        this.fixtures.set(fixture.id, fixture);
    }

    /**
     * Set up job to return a specific fixture's result
     */
    setJobFixture(jobId: string, fixtureId: string): void {
        const fixture = this.fixtures.get(fixtureId);
        if (!fixture) {
            throw new Error(`Fixture ${fixtureId} not found`);
        }

        this.results.set(jobId, {
            ocr_job_id: jobId,
            status: 'completed',
            extracted: fixture.extracted,
            confidence: fixture.confidence,
        });
    }

    /**
     * Set up job to fail
     */
    setJobFailure(jobId: string, errorMessage: string): void {
        this.results.set(jobId, {
            ocr_job_id: jobId,
            status: 'failed',
            error_message: errorMessage,
        });
    }

    /**
     * Check if a job was processed
     */
    wasProcessed(jobId: string): boolean {
        return this.processedJobs.has(jobId);
    }

    /**
     * Get all processed job IDs
     */
    getProcessedJobs(): string[] {
        return [...this.processedJobs];
    }
}

// =============================================================================
// Pre-defined OCR Results for Common Scenarios
// =============================================================================

export const OCR_RESULTS = {
    /**
     * High confidence prescription OCR result
     */
    prescriptionHighConfidence: (jobId: string): OcrResult => ({
        ocr_job_id: jobId,
        status: 'completed',
        extracted: {
            patient_name: 'Jean Bosco',
            medications: [
                { name: 'Amoxicillin 500mg', quantity: 21, dosage: '3x daily' },
                { name: 'Paracetamol 500mg', quantity: 14, dosage: '2x daily' },
            ],
            doctor_name: 'Dr. Uwimana',
            hospital: 'King Faisal Hospital',
            date: '2026-01-15',
        },
        confidence: 0.95,
    }),

    /**
     * Low confidence prescription OCR result
     */
    prescriptionLowConfidence: (jobId: string): OcrResult => ({
        ocr_job_id: jobId,
        status: 'completed',
        extracted: {
            patient_name: 'J??? B???',
            medications: [{ name: 'Amox???', quantity: null }],
            doctor_name: null,
        },
        confidence: 0.42,
    }),

    /**
     * Failed OCR (unreadable image)
     */
    failed: (jobId: string, reason: string = 'Image too blurry to process'): OcrResult => ({
        ocr_job_id: jobId,
        status: 'failed',
        error_message: reason,
    }),

    /**
     * Product photo OCR result
     */
    productPhoto: (jobId: string, productType: string): OcrResult => ({
        ocr_job_id: jobId,
        status: 'completed',
        extracted: {
            product_type: productType,
            detected_text: [],
            labels: [productType],
        },
        confidence: 0.78,
    }),
};

// =============================================================================
// Factory
// =============================================================================

export function createGeminiOcrMock(config?: GeminiOcrMockConfig): GeminiOcrMock {
    return new GeminiOcrMock(config);
}
