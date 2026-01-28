import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    OcrType,
    OcrOutput,
    OcrMetaSchema,
    MedicalOcrExtractedSchema,
    GeneralOcrExtractedSchema,
    ConfidenceSchema,
    OcrWarning,
    RawMedicalExtractionSchema,
    RawGeneralExtractionSchema,
    hasDrugNameUncertainty,
    calculateMedicalConfidence,
    type MedicalPrescriptionFields,
} from './schemas.js';

// =============================================================================
// Prompts
// =============================================================================

const MEDICAL_PRESCRIPTION_PROMPT = `You are an expert medical document reader. Analyze this prescription image and extract information faithfully.

CRITICAL RULES:
1. Extract EXACTLY what you see - never guess or infer medication names
2. If ANY text is unclear, mark it uncertain and lower confidence
3. Never suggest alternative medications or provide medical advice
4. Include confidence scores (0.0-1.0) for every field

OUTPUT FORMAT (JSON only, no markdown):
{
  "text_full": "Complete visible text from the document",
  "fields": {
    "patient_name": "string or null",
    "prescriber_name": "string or null",
    "facility": "string or null",
    "date": "YYYY-MM-DD or null",
    "items": [{"drug_name": "", "dose": "", "form": "", "quantity": "", "instructions": ""}]
  },
  "confidence": {
    "overall": 0.0-1.0,
    "text_full": 0.0-1.0,
    "fields": {"patient_name": 0.0-1.0, "items": [{"drug_name": 0.0-1.0, "dose": 0.0-1.0}]}
  },
  "warnings": []
}

If drug_name cannot be read with >0.75 confidence, add "uncertain_drug_name" to warnings.`;

const GENERAL_DOCUMENT_PROMPT = `You are a product and document extraction assistant. Analyze this image and extract relevant marketplace information.

OUTPUT FORMAT (JSON only, no markdown):
{
  "text_full": "All visible text from the image",
  "fields": {
    "product_keywords": [],
    "brands": [],
    "models": [],
    "colors": [],
    "quantities": [],
    "addresses_or_landmarks": [],
    "phone_numbers": [],
    "notes": ""
  },
  "confidence": {
    "overall": 0.0-1.0,
    "text_full": 0.0-1.0,
    "fields": {}
  },
  "warnings": []
}`;

// =============================================================================
// Provider Interface
// =============================================================================

export interface GeminiOcrOptions {
    apiKey: string;
    model?: string;
}

export interface OcrExtractionResult {
    success: boolean;
    output?: OcrOutput;
    rawResponse?: unknown;
    error?: string;
}

// =============================================================================
// Gemini OCR Provider
// =============================================================================

export class GeminiOcrProvider {
    private client: GoogleGenerativeAI;
    private model: string;

    constructor(options: GeminiOcrOptions) {
        this.client = new GoogleGenerativeAI(options.apiKey);
        this.model = options.model ?? 'gemini-1.5-flash';
    }

    async extractFromImage(
        imageUrl: string,
        ocrType: OcrType,
        sourceMessageId?: string
    ): Promise<OcrExtractionResult> {
        try {
            const genModel = this.client.getGenerativeModel({
                model: this.model,
                generationConfig: {
                    temperature: 0,
                    responseMimeType: 'application/json',
                },
            });

            // Fetch image and convert to base64
            const imageData = await this.fetchImageAsBase64(imageUrl);

            const prompt = ocrType === 'medical_prescription'
                ? MEDICAL_PRESCRIPTION_PROMPT
                : GENERAL_DOCUMENT_PROMPT;

            const result = await genModel.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: imageData.mimeType,
                        data: imageData.base64,
                    },
                },
            ]);

            const responseText = result.response.text();
            const rawJson = this.parseJsonResponse(responseText);

            // Validate and transform to OcrOutput
            const output = this.transformToOcrOutput(rawJson, ocrType, sourceMessageId);

            return {
                success: true,
                output,
                rawResponse: rawJson,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
        return { base64, mimeType };
    }

    private parseJsonResponse(text: string): unknown {
        // Handle potential markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
        return JSON.parse(jsonStr);
    }

    private transformToOcrOutput(
        raw: unknown,
        ocrType: OcrType,
        sourceMessageId?: string
    ): OcrOutput {
        const schema = ocrType === 'medical_prescription'
            ? RawMedicalExtractionSchema
            : RawGeneralExtractionSchema;

        const parsed = schema.parse(raw);

        // Build warnings array
        const warnings: OcrWarning[] = [];
        if (parsed.warnings) {
            for (const w of parsed.warnings) {
                const validWarning = OcrWarning.safeParse(w);
                if (validWarning.success) {
                    warnings.push(validWarning.data);
                }
            }
        }

        // Check for drug name uncertainty in medical prescriptions
        if (ocrType === 'medical_prescription') {
            const fields = parsed.fields as MedicalPrescriptionFields;
            const hasUncertainty = hasDrugNameUncertainty(
                fields,
                parsed.confidence.fields as Record<string, unknown>
            );
            if (hasUncertainty && !warnings.includes('uncertain_drug_name')) {
                warnings.push('uncertain_drug_name');
            }
        }

        // Calculate overall confidence
        let overallConfidence = parsed.confidence.overall;
        if (ocrType === 'medical_prescription' && parsed.confidence.fields) {
            overallConfidence = calculateMedicalConfidence(
                parsed.confidence.fields as Record<string, number | Record<string, number>[]>
            );
        }

        return {
            meta: OcrMetaSchema.parse({
                ocr_type: ocrType,
                engine: 'gemini',
                source_message_id: sourceMessageId,
                processed_at: new Date().toISOString(),
            }),
            extracted:
                ocrType === 'medical_prescription'
                    ? MedicalOcrExtractedSchema.parse({ text_full: parsed.text_full, fields: parsed.fields })
                    : GeneralOcrExtractedSchema.parse({ text_full: parsed.text_full, fields: parsed.fields }),
            confidence: ConfidenceSchema.parse({
                overall: overallConfidence,
                text_full: parsed.confidence.text_full,
                fields: parsed.confidence.fields,
            }),
            warnings,
        };
    }
}
