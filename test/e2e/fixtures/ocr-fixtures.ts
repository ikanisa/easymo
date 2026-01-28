/**
 * OCR Fixtures
 * 
 * Pre-defined OCR results for E2E testing scenarios.
 */

import type { OcrResult } from '../scenario-runner';

// =============================================================================
// Prescription Fixtures
// =============================================================================

/**
 * High confidence prescription with complete data
 */
export const PRESCRIPTION_HIGH_CONFIDENCE: OcrResult = {
    ocr_job_id: 'ocr_prescription_high',
    status: 'completed',
    extracted: {
        patient_name: 'Jean Bosco Mutangana',
        medications: [
            {
                name: 'Amoxicillin 500mg',
                quantity: 21,
                dosage: '3 times daily',
                duration: '7 days',
            },
            {
                name: 'Paracetamol 500mg',
                quantity: 14,
                dosage: '2 times daily as needed',
                duration: 'As needed',
            },
            {
                name: 'Vitamin C 1000mg',
                quantity: 30,
                dosage: '1 daily',
                duration: '30 days',
            },
        ],
        doctor_name: 'Dr. Marie Uwimana',
        hospital: 'King Faisal Hospital',
        prescription_date: '2026-01-15',
        notes: 'Take medications with food. Avoid alcohol.',
        signature_present: true,
    },
    confidence: 0.95,
};

/**
 * Low confidence prescription (blurry, partial)
 */
export const PRESCRIPTION_LOW_CONFIDENCE: OcrResult = {
    ocr_job_id: 'ocr_prescription_low',
    status: 'completed',
    extracted: {
        patient_name: 'J??? B??? M???',
        medications: [
            {
                name: 'Amox???',
                quantity: null,
                dosage: '??? daily',
            },
        ],
        doctor_name: null,
        hospital: 'K??? F??? Hospital',
        prescription_date: null,
        notes: null,
    },
    confidence: 0.42,
};

/**
 * Failed OCR (unreadable image)
 */
export const PRESCRIPTION_FAILED: OcrResult = {
    ocr_job_id: 'ocr_prescription_failed',
    status: 'failed',
    error_message: 'Image too blurry to extract text. Please send a clearer photo.',
};

/**
 * Medium confidence prescription (some fields unclear)
 */
export const PRESCRIPTION_MEDIUM_CONFIDENCE: OcrResult = {
    ocr_job_id: 'ocr_prescription_medium',
    status: 'completed',
    extracted: {
        patient_name: 'Jean Bosco',
        medications: [
            {
                name: 'Amoxicillin 500mg',
                quantity: 21,
                dosage: '3 times daily',
            },
        ],
        doctor_name: 'Dr. M??? Uwimana',
        hospital: 'King Faisal Hospital',
        prescription_date: '2026-01-??',
        notes: null,
    },
    confidence: 0.68,
};

// =============================================================================
// Invoice Fixtures
// =============================================================================

/**
 * Pharmacy invoice
 */
export const INVOICE_PHARMACY: OcrResult = {
    ocr_job_id: 'ocr_invoice_pharmacy',
    status: 'completed',
    extracted: {
        vendor_name: 'Pharmacy Plus Kigali',
        vendor_address: 'KN 12 St, Kigali',
        vendor_phone: '+250788123456',
        items: [
            { name: 'Amoxicillin 500mg x21', unit_price: 150, total: 3150 },
            { name: 'Paracetamol 500mg x14', unit_price: 50, total: 700 },
            { name: 'Vitamin C 1000mg x30', unit_price: 100, total: 3000 },
        ],
        subtotal: 6850,
        vat: 1232,
        total: 8082,
        currency: 'RWF',
        date: '2026-01-20',
        invoice_number: 'INV-2026-0123',
    },
    confidence: 0.91,
};

// =============================================================================
// Product Photo Fixtures
// =============================================================================

/**
 * Phone case product photo
 */
export const PRODUCT_PHONE_CASE: OcrResult = {
    ocr_job_id: 'ocr_product_phone_case',
    status: 'completed',
    extracted: {
        product_type: 'phone_case',
        detected_labels: ['phone case', 'mobile accessory', 'protective cover'],
        brand: null,
        model_compatibility: null,
        color: 'black',
        material: 'silicone',
        detected_text: [],
    },
    confidence: 0.78,
};

/**
 * Generic document photo
 */
export const DOCUMENT_GENERIC: OcrResult = {
    ocr_job_id: 'ocr_document_generic',
    status: 'completed',
    extracted: {
        document_type: 'unknown',
        detected_text: ['Sample text from document'],
        has_signature: false,
        has_stamp: false,
    },
    confidence: 0.65,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a custom OCR result with specified job ID
 */
export function createOcrResult(
    jobId: string,
    template: OcrResult,
): OcrResult {
    return {
        ...template,
        ocr_job_id: jobId,
    };
}

/**
 * Create a prescription OCR result with custom medications
 */
export function createPrescriptionOcr(
    jobId: string,
    medications: Array<{ name: string; quantity: number; dosage: string }>,
    confidence: number = 0.9,
): OcrResult {
    return {
        ocr_job_id: jobId,
        status: 'completed',
        extracted: {
            patient_name: 'Test Patient',
            medications,
            doctor_name: 'Dr. Test',
            hospital: 'Test Hospital',
            prescription_date: new Date().toISOString().split('T')[0],
        },
        confidence,
    };
}

/**
 * Create a failed OCR result
 */
export function createFailedOcr(
    jobId: string,
    errorMessage: string,
): OcrResult {
    return {
        ocr_job_id: jobId,
        status: 'failed',
        error_message: errorMessage,
    };
}

// =============================================================================
// All Fixtures Export
// =============================================================================

export const OCR_FIXTURES = {
    prescription: {
        high: PRESCRIPTION_HIGH_CONFIDENCE,
        low: PRESCRIPTION_LOW_CONFIDENCE,
        medium: PRESCRIPTION_MEDIUM_CONFIDENCE,
        failed: PRESCRIPTION_FAILED,
    },
    invoice: {
        pharmacy: INVOICE_PHARMACY,
    },
    product: {
        phoneCase: PRODUCT_PHONE_CASE,
        generic: DOCUMENT_GENERIC,
    },
};
