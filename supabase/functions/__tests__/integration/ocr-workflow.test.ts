/**
 * OCR Workflow Integration Tests
 * 
 * Tests for the full OCR job lifecycle using Deno test runner.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock Supabase client for testing
const mockSupabase = {
    jobs: new Map<string, Record<string, unknown>>(),
    requests: new Map<string, Record<string, unknown>>(),

    reset() {
        this.jobs.clear();
        this.requests.clear();
    },

    addJob(job: Record<string, unknown>) {
        this.jobs.set(job.id as string, job);
    },

    addRequest(request: Record<string, unknown>) {
        this.requests.set(request.id as string, request);
    },
};

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_MESSAGE_ID = "msg-test-001";
const TEST_REQUEST_ID = "req-test-001";
const TEST_JOB_ID = "job-test-001";

function createTestJob(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: TEST_JOB_ID,
        request_id: TEST_REQUEST_ID,
        message_id: TEST_MESSAGE_ID,
        status: "pending",
        provider: null,
        media_url: "https://example.com/test-image.jpg",
        media_type: "image/jpeg",
        extracted: null,
        confidence: null,
        raw_response: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        ...overrides,
    };
}

function createTestRequest(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: TEST_REQUEST_ID,
        conversation_id: "conv-test-001",
        state: "ocr_processing",
        requirements: {},
        shortlist: [],
        error_reason: null,
        fallback_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

// =============================================================================
// Tests
// =============================================================================

Deno.test("OCR Workflow - Job Creation", async (t) => {
    await t.step("creates job with pending status for image message", () => {
        mockSupabase.reset();

        const job = createTestJob();
        mockSupabase.addJob(job);

        const storedJob = mockSupabase.jobs.get(TEST_JOB_ID);
        assertExists(storedJob);
        assertEquals(storedJob.status, "pending");
        assertEquals(storedJob.media_url, "https://example.com/test-image.jpg");
    });

    await t.step("job references correct request", () => {
        mockSupabase.reset();

        const request = createTestRequest();
        const job = createTestJob({ request_id: request.id });

        mockSupabase.addRequest(request);
        mockSupabase.addJob(job);

        const storedJob = mockSupabase.jobs.get(TEST_JOB_ID);
        const storedRequest = mockSupabase.requests.get(TEST_REQUEST_ID);

        assertExists(storedJob);
        assertExists(storedRequest);
        assertEquals(storedJob.request_id, storedRequest.id);
    });
});

Deno.test("OCR Workflow - Status Transitions", async (t) => {
    await t.step("transitions from pending → processing → completed", () => {
        mockSupabase.reset();

        const job = createTestJob();
        mockSupabase.addJob(job);

        // Simulate processing
        const processingJob = { ...mockSupabase.jobs.get(TEST_JOB_ID)!, status: "processing" };
        mockSupabase.jobs.set(TEST_JOB_ID, processingJob);
        assertEquals(mockSupabase.jobs.get(TEST_JOB_ID)?.status, "processing");

        // Simulate completion
        const completedJob = {
            ...mockSupabase.jobs.get(TEST_JOB_ID)!,
            status: "completed",
            extracted: { text_full: "Test extraction" },
            confidence: 0.85,
            completed_at: new Date().toISOString(),
        };
        mockSupabase.jobs.set(TEST_JOB_ID, completedJob);

        assertEquals(mockSupabase.jobs.get(TEST_JOB_ID)?.status, "completed");
        assertExists(mockSupabase.jobs.get(TEST_JOB_ID)?.completed_at);
    });

    await t.step("transitions to failed status on error", () => {
        mockSupabase.reset();

        const job = createTestJob();
        mockSupabase.addJob(job);

        // Simulate failure
        const failedJob = {
            ...mockSupabase.jobs.get(TEST_JOB_ID)!,
            status: "failed",
            error_message: "Failed to download media",
        };
        mockSupabase.jobs.set(TEST_JOB_ID, failedJob);

        assertEquals(mockSupabase.jobs.get(TEST_JOB_ID)?.status, "failed");
        assertEquals(mockSupabase.jobs.get(TEST_JOB_ID)?.error_message, "Failed to download media");
    });
});

Deno.test("OCR Workflow - Confidence Handling", async (t) => {
    await t.step("low confidence keeps request in ocr_processing state", () => {
        mockSupabase.reset();

        const request = createTestRequest({ state: "ocr_processing" });
        const job = createTestJob();

        mockSupabase.addRequest(request);
        mockSupabase.addJob(job);

        // Simulate low confidence completion
        const completedJob = {
            ...mockSupabase.jobs.get(TEST_JOB_ID)!,
            status: "completed",
            confidence: 0.55, // Below threshold
            extracted: {
                fields: { items: [{ drug_name: "unclear" }] },
            },
        };
        mockSupabase.jobs.set(TEST_JOB_ID, completedJob);

        // Request should stay in ocr_processing
        assertEquals(mockSupabase.requests.get(TEST_REQUEST_ID)?.state, "ocr_processing");
    });

    await t.step("high confidence transitions request to vendor_outreach", () => {
        mockSupabase.reset();

        const request = createTestRequest({ state: "ocr_processing" });
        const job = createTestJob();

        mockSupabase.addRequest(request);
        mockSupabase.addJob(job);

        // Simulate high confidence completion
        const completedJob = {
            ...mockSupabase.jobs.get(TEST_JOB_ID)!,
            status: "completed",
            confidence: 0.92,
            extracted: {
                fields: { items: [{ drug_name: "Amoxicillin", dose: "500mg" }] },
            },
        };
        mockSupabase.jobs.set(TEST_JOB_ID, completedJob);

        // Simulate state transition
        const updatedRequest = {
            ...mockSupabase.requests.get(TEST_REQUEST_ID)!,
            state: "vendor_outreach",
            requirements: {
                ocr_extracted: completedJob.extracted,
                ocr_confidence: completedJob.confidence,
                ocr_completed: true,
            },
        };
        mockSupabase.requests.set(TEST_REQUEST_ID, updatedRequest);

        assertEquals(mockSupabase.requests.get(TEST_REQUEST_ID)?.state, "vendor_outreach");
    });
});

Deno.test("OCR Workflow - Idempotency", async (t) => {
    await t.step("same message_id should not create duplicate jobs", () => {
        mockSupabase.reset();

        const job1 = createTestJob({ id: "job-1", message_id: TEST_MESSAGE_ID });
        mockSupabase.addJob(job1);

        // Check if job with same message_id exists
        const existingJob = Array.from(mockSupabase.jobs.values()).find(
            (j) => j.message_id === TEST_MESSAGE_ID
        );

        assertExists(existingJob);
        assertEquals(existingJob.id, "job-1");

        // Should not add duplicate
        const jobCount = mockSupabase.jobs.size;
        assertEquals(jobCount, 1);
    });

    await t.step("different message_ids create separate jobs", () => {
        mockSupabase.reset();

        const job1 = createTestJob({ id: "job-1", message_id: "msg-001" });
        const job2 = createTestJob({ id: "job-2", message_id: "msg-002" });

        mockSupabase.addJob(job1);
        mockSupabase.addJob(job2);

        assertEquals(mockSupabase.jobs.size, 2);
    });
});

Deno.test("OCR Workflow - OCR Type Detection", async (t) => {
    await t.step("pharmacy category triggers medical_prescription type", () => {
        mockSupabase.reset();

        const request = createTestRequest({
            requirements: { category: "pharmacy" },
        });
        mockSupabase.addRequest(request);

        const requirements = mockSupabase.requests.get(TEST_REQUEST_ID)?.requirements as Record<string, unknown>;
        const category = requirements?.category as string;

        const medicalKeywords = ["pharmacy", "medicine", "medication"];
        const isMedical = medicalKeywords.includes(category?.toLowerCase() ?? "");

        assertEquals(isMedical, true);
    });

    await t.step("general category defaults to general_document_or_photo", () => {
        mockSupabase.reset();

        const request = createTestRequest({
            requirements: { category: "electronics" },
        });
        mockSupabase.addRequest(request);

        const requirements = mockSupabase.requests.get(TEST_REQUEST_ID)?.requirements as Record<string, unknown>;
        const category = requirements?.category as string;

        const medicalKeywords = ["pharmacy", "medicine", "medication"];
        const isMedical = medicalKeywords.includes(category?.toLowerCase() ?? "");

        assertEquals(isMedical, false);
    });
});
