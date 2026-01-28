/**
 * OCR Worker Service
 * 
 * Processes queued OCR jobs from moltbot_ocr_jobs table:
 * 1. Fetch next pending job
 * 2. Download media
 * 3. Call Gemini Vision (with OpenAI fallback)
 * 4. Validate and store results
 * 5. Handle low confidence → clarification flow
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
    GeminiOcrProvider,
    type OcrOutput,
    type OcrType,
    hasDrugNameUncertainty,
    type MedicalPrescriptionFields,
} from '@insure/ocr-extract';

// =============================================================================
// Types
// =============================================================================

interface OcrJob {
    id: string;
    request_id: string;
    message_id: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    provider: string | null;
    media_url: string;
    media_type: string | null;
    extracted: Record<string, unknown> | null;
    confidence: number | null;
    raw_response: Record<string, unknown> | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

interface ProcessResult {
    success: boolean;
    jobId: string;
    needsClarification: boolean;
    clarificationFields?: string[];
    error?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    batchSize: 5,
    maxRetries: 2,
    confidenceThreshold: {
        drugName: 0.75,
        general: 0.6,
    },
};

// =============================================================================
// OCR Worker Class
// =============================================================================

export class OcrWorker {
    private supabase: SupabaseClient;
    private geminiProvider: GeminiOcrProvider;
    private isRunning = false;

    constructor(
        supabaseUrl: string,
        supabaseServiceKey: string,
        geminiApiKey: string
    ) {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.geminiProvider = new GeminiOcrProvider({ apiKey: geminiApiKey });
    }

    /**
     * Process a batch of pending OCR jobs
     */
    async processNextBatch(): Promise<ProcessResult[]> {
        const jobs = await this.fetchPendingJobs();
        if (jobs.length === 0) {
            return [];
        }

        const results: ProcessResult[] = [];
        for (const job of jobs) {
            const result = await this.processJob(job);
            results.push(result);
        }

        return results;
    }

    /**
     * Run worker loop (for long-running process)
     */
    async runLoop(intervalMs = 5000): Promise<void> {
        this.isRunning = true;
        console.log('[OCR Worker] Starting worker loop');

        while (this.isRunning) {
            try {
                const results = await this.processNextBatch();
                if (results.length > 0) {
                    console.log(`[OCR Worker] Processed ${results.length} jobs`);
                }
            } catch (error) {
                console.error('[OCR Worker] Batch processing error:', error);
            }
            await this.sleep(intervalMs);
        }
    }

    stop(): void {
        this.isRunning = false;
    }

    // ---------------------------------------------------------------------------
    // Private Methods
    // ---------------------------------------------------------------------------

    private async fetchPendingJobs(): Promise<OcrJob[]> {
        const { data, error } = await this.supabase
            .from('moltbot_ocr_jobs')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(CONFIG.batchSize);

        if (error) {
            console.error('[OCR Worker] Failed to fetch jobs:', error);
            return [];
        }

        return data ?? [];
    }

    private async processJob(job: OcrJob): Promise<ProcessResult> {
        const startTime = Date.now();

        try {
            // Mark job as processing
            await this.updateJobStatus(job.id, 'processing');

            // Determine OCR type from request context
            const ocrType = await this.determineOcrType(job);

            // Run OCR extraction
            const result = await this.geminiProvider.extractFromImage(
                job.media_url,
                ocrType,
                job.message_id ?? undefined
            );

            if (!result.success || !result.output) {
                throw new Error(result.error ?? 'OCR extraction failed');
            }

            // Check for low confidence warnings
            const { needsClarification, clarificationFields } = this.checkConfidence(
                result.output,
                ocrType
            );

            // Store results
            await this.supabase
                .from('moltbot_ocr_jobs')
                .update({
                    status: 'completed',
                    provider: 'gemini',
                    extracted: result.output.extracted,
                    confidence: result.output.confidence.overall,
                    raw_response: result.rawResponse as Record<string, unknown>,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', job.id);

            // If low confidence, update request state and trigger clarification
            if (needsClarification) {
                await this.handleLowConfidence(job.request_id, clarificationFields);
            } else {
                // Mark request as ready for vendor outreach
                await this.markRequestComplete(job.request_id, result.output);
            }

            console.log(
                `[OCR Worker] Job ${job.id} completed in ${Date.now() - startTime}ms ` +
                `(confidence: ${result.output.confidence.overall.toFixed(2)}, ` +
                `needsClarification: ${needsClarification})`
            );

            return {
                success: true,
                jobId: job.id,
                needsClarification,
                clarificationFields,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await this.supabase
                .from('moltbot_ocr_jobs')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                })
                .eq('id', job.id);

            console.error(`[OCR Worker] Job ${job.id} failed:`, errorMessage);

            return {
                success: false,
                jobId: job.id,
                needsClarification: false,
                error: errorMessage,
            };
        }
    }

    private async determineOcrType(job: OcrJob): Promise<OcrType> {
        // Fetch request context to determine OCR type
        const { data: request } = await this.supabase
            .from('moltbot_marketplace_requests')
            .select('requirements')
            .eq('id', job.request_id)
            .single();

        const requirements = request?.requirements as Record<string, unknown> | null;
        const category = requirements?.category as string | undefined;

        // Medical keywords in category or requirements
        const medicalKeywords = ['pharmacy', 'medicine', 'medication', 'prescription', 'drug'];
        if (category && medicalKeywords.includes(category.toLowerCase())) {
            return 'medical_prescription';
        }

        // Check media type for document hints
        if (job.media_type?.includes('pdf') || job.media_type?.includes('document')) {
            // Could be prescription document - default to medical for safety
            return 'medical_prescription';
        }

        return 'general_document_or_photo';
    }

    private checkConfidence(
        output: OcrOutput,
        ocrType: OcrType
    ): { needsClarification: boolean; clarificationFields: string[] } {
        const clarificationFields: string[] = [];

        // Check for explicit warnings
        if (output.warnings.includes('uncertain_drug_name')) {
            clarificationFields.push('drug_name');
        }
        if (output.warnings.includes('uncertain_dose')) {
            clarificationFields.push('dose');
        }

        // For medical prescriptions, check drug name confidence
        if (ocrType === 'medical_prescription') {
            const fields = output.extracted.fields as MedicalPrescriptionFields;
            const hasUncertainty = hasDrugNameUncertainty(
                fields,
                output.confidence.fields,
                CONFIG.confidenceThreshold.drugName
            );
            if (hasUncertainty && !clarificationFields.includes('drug_name')) {
                clarificationFields.push('drug_name');
            }
        }

        // Check overall confidence
        if (output.confidence.overall < CONFIG.confidenceThreshold.general) {
            clarificationFields.push('general_quality');
        }

        return {
            needsClarification: clarificationFields.length > 0,
            clarificationFields,
        };
    }

    private async handleLowConfidence(
        requestId: string,
        clarificationFields: string[]
    ): Promise<void> {
        // Keep request in ocr_processing state
        await this.supabase
            .from('moltbot_marketplace_requests')
            .update({
                state: 'ocr_processing',
                requirements: this.supabase.rpc('jsonb_set', {
                    target: 'requirements',
                    path: '{ocr_clarification_needed}',
                    new_value: true,
                }),
            })
            .eq('id', requestId);

        // Log clarification needed
        console.log(
            `[OCR Worker] Request ${requestId} needs clarification for: ${clarificationFields.join(', ')}`
        );
    }

    private async markRequestComplete(
        requestId: string,
        output: OcrOutput
    ): Promise<void> {
        // Update request requirements with extracted data
        const { data: request } = await this.supabase
            .from('moltbot_marketplace_requests')
            .select('requirements')
            .eq('id', requestId)
            .single();

        const existingRequirements = request?.requirements as Record<string, unknown> ?? {};
        const updatedRequirements = {
            ...existingRequirements,
            ocr_extracted: output.extracted.fields,
            ocr_confidence: output.confidence.overall,
            ocr_completed: true,
        };

        // Transition to vendor_outreach state
        await this.supabase
            .from('moltbot_marketplace_requests')
            .update({
                state: 'vendor_outreach',
                requirements: updatedRequirements,
            })
            .eq('id', requestId);
    }

    private async updateJobStatus(
        jobId: string,
        status: OcrJob['status']
    ): Promise<void> {
        await this.supabase
            .from('moltbot_ocr_jobs')
            .update({ status })
            .eq('id', jobId);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createOcrWorker(): OcrWorker {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
        throw new Error(
            'Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY'
        );
    }

    return new OcrWorker(supabaseUrl, supabaseServiceKey, geminiApiKey);
}
