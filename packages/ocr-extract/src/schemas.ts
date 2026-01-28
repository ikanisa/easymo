import { z } from 'zod';

// =============================================================================
// Medical Prescription Schemas
// =============================================================================

export const PrescriptionItemSchema = z.object({
    drug_name: z.string(),
    dose: z.string().optional(),
    form: z.string().optional(),
    quantity: z.union([z.string(), z.number()]).nullish(),
    instructions: z.string().optional(),
});
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>;

export const MedicalPrescriptionFieldsSchema = z.object({
    patient_name: z.string().nullish(),
    prescriber_name: z.string().nullish(),
    facility: z.string().nullish(),
    date: z.string().nullish(),
    items: z.array(PrescriptionItemSchema).default([]),
});
export type MedicalPrescriptionFields = z.infer<typeof MedicalPrescriptionFieldsSchema>;

// =============================================================================
// General Document Schemas
// =============================================================================

export const GeneralDocumentFieldsSchema = z.object({
    product_keywords: z.array(z.string()).default([]),
    brands: z.array(z.string()).default([]),
    models: z.array(z.string()).default([]),
    colors: z.array(z.string()).default([]),
    quantities: z.array(z.union([z.string(), z.number()])).default([]),
    addresses_or_landmarks: z.array(z.string()).default([]),
    phone_numbers: z.array(z.string()).default([]),
    notes: z.string().optional(),
});
export type GeneralDocumentFields = z.infer<typeof GeneralDocumentFieldsSchema>;

// =============================================================================
// Confidence Schemas
// =============================================================================

export const OcrWarning = z.enum([
    'uncertain_drug_name',
    'uncertain_dose',
    'possible_abbreviation',
    'low_image_quality',
    'partial_extraction',
    'uncertain_brand',
    'uncertain_address',
]);
export type OcrWarning = z.infer<typeof OcrWarning>;

export const ConfidenceSchema = z.object({
    overall: z.number().min(0).max(1),
    text_full: z.number().min(0).max(1).optional(),
    // Field-level confidence may be a flat map or nested (e.g. medical `items` array).
    fields: z
        .record(
            z.string(),
            z.union([
                z.number().min(0).max(1),
                z.record(z.string(), z.number().min(0).max(1)),
                z.array(z.record(z.string(), z.number().min(0).max(1))),
            ]),
        )
        .optional(),
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

// =============================================================================
// OCR Output Meta & Full Schema
// =============================================================================

export const OcrType = z.enum(['medical_prescription', 'general_document_or_photo']);
export type OcrType = z.infer<typeof OcrType>;

export const OcrEngine = z.enum(['gemini', 'openai']);
export type OcrEngine = z.infer<typeof OcrEngine>;

export const OcrMetaSchema = z.object({
    ocr_type: OcrType,
    engine: OcrEngine,
    source_message_id: z.string().optional(),
    processed_at: z.string().datetime(),
});
export type OcrMeta = z.infer<typeof OcrMetaSchema>;

export const MedicalOcrExtractedSchema = z.object({
    text_full: z.string().optional(),
    fields: MedicalPrescriptionFieldsSchema,
});
export type MedicalOcrExtracted = z.infer<typeof MedicalOcrExtractedSchema>;

export const GeneralOcrExtractedSchema = z.object({
    text_full: z.string().optional(),
    fields: GeneralDocumentFieldsSchema,
});
export type GeneralOcrExtracted = z.infer<typeof GeneralOcrExtractedSchema>;

export const OcrExtractedSchema = z.union([MedicalOcrExtractedSchema, GeneralOcrExtractedSchema]);
export type OcrExtracted = z.infer<typeof OcrExtractedSchema>;

const MedicalOcrOutputSchema = z.object({
    meta: OcrMetaSchema.extend({ ocr_type: z.literal('medical_prescription') }),
    extracted: MedicalOcrExtractedSchema,
    confidence: ConfidenceSchema,
    warnings: z.array(OcrWarning).default([]),
});

const GeneralOcrOutputSchema = z.object({
    meta: OcrMetaSchema.extend({ ocr_type: z.literal('general_document_or_photo') }),
    extracted: GeneralOcrExtractedSchema,
    confidence: ConfidenceSchema,
    warnings: z.array(OcrWarning).default([]),
});

export const OcrOutputSchema = z.union([MedicalOcrOutputSchema, GeneralOcrOutputSchema]);
export type OcrOutput = z.infer<typeof OcrOutputSchema>;

// =============================================================================
// Raw Extraction Response (from LLM)
// =============================================================================

export const RawMedicalExtractionSchema = z.object({
    text_full: z.string().optional(),
    fields: MedicalPrescriptionFieldsSchema,
    confidence: z.object({
        overall: z.number(),
        text_full: z.number().optional(),
        fields: z.record(z.string(), z.any()).optional(),
    }),
    warnings: z.array(z.string()).optional(),
});

export const RawGeneralExtractionSchema = z.object({
    text_full: z.string().optional(),
    fields: GeneralDocumentFieldsSchema,
    confidence: z.object({
        overall: z.number(),
        text_full: z.number().optional(),
        fields: z.record(z.string(), z.any()).optional(),
    }),
    warnings: z.array(z.string()).optional(),
});

// =============================================================================
// Helpers
// =============================================================================

/** Check if any drug items have low confidence */
export function hasDrugNameUncertainty(
    fields: MedicalPrescriptionFields,
    confidenceFields?: Record<string, unknown>,
    threshold = 0.75
): boolean {
    if (!confidenceFields?.items || !Array.isArray(confidenceFields.items)) {
        return false;
    }
    return (confidenceFields.items as Array<{ drug_name?: number }>).some(
        (item) => item.drug_name !== undefined && item.drug_name < threshold
    );
}

/** Calculate weighted overall confidence for medical prescription */
export function calculateMedicalConfidence(
    fieldConfidences: Record<string, number | Record<string, number>[]>
): number {
    const weights: Record<string, number> = {
        patient_name: 0.1,
        prescriber_name: 0.1,
        facility: 0.05,
        date: 0.05,
        items: 0.7,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, value] of Object.entries(fieldConfidences)) {
        const weight = weights[key] ?? 0.1;
        if (key === 'items' && Array.isArray(value)) {
            // Average item confidences, heavily weight drug_name
            const itemScores = value.map((item) => {
                const drugConf = (item as Record<string, number>).drug_name ?? 0.5;
                const doseConf = (item as Record<string, number>).dose ?? 0.8;
                return drugConf * 0.7 + doseConf * 0.3;
            });
            const avgItemScore = itemScores.length > 0
                ? itemScores.reduce((a, b) => a + b, 0) / itemScores.length
                : 0.5;
            weightedSum += avgItemScore * weight;
            totalWeight += weight;
        } else if (typeof value === 'number') {
            weightedSum += value * weight;
            totalWeight += weight;
        }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}
