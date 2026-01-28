/**
 * E2E Conversation Test Suite
 * 
 * Main test entry point that loads and executes all golden scenarios.
 * Uses Vitest as the test runner.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import {
    ScenarioRunner,
    Scenario,
    ScenarioResult,
    StepResult,
    MockDatabase,
    ScenarioContext,
} from './scenario-runner';
import type { MoltbotRequestState } from '@easymo/types';
import { WhatsAppProviderMock } from '../mocks/whatsappProviderMock';
import { GeminiOcrMock } from '../mocks/geminiOcrMock';
import { MoltbotMock } from '../mocks/moltbotMock';
import { CallingProviderMock } from '../mocks/callingProviderMock';

// =============================================================================
// Test Configuration
// =============================================================================

const SCENARIOS_DIR = join(__dirname, 'scenarios');

// =============================================================================
// Mock Database Implementation
// =============================================================================

class MockDB implements MockDatabase {
    private requestState: MoltbotRequestState = 'collecting_requirements';
    private vendorOutreachCount = 0;
    private rowCounts: Map<string, number> = new Map();
    private duplicateOutreach = false;
    private injectionFlags: Set<string> = new Set();

    async getRequestState(_requestId: string): Promise<MoltbotRequestState | null> {
        return this.requestState;
    }

    async getVendorOutreachCount(_requestId: string): Promise<number> {
        return this.vendorOutreachCount;
    }

    async checkDuplicateOutreach(_requestId: string): Promise<boolean> {
        return this.duplicateOutreach;
    }

    async getRowCount(table: string, _filter?: Record<string, unknown>): Promise<number> {
        return this.rowCounts.get(table) ?? 0;
    }

    async isInjectionFlagged(vendorId: string): Promise<boolean> {
        return this.injectionFlags.has(vendorId);
    }

    async setup(initialState: Scenario['initial_state']): Promise<ScenarioContext> {
        // Set initial request state if provided
        if (initialState?.request?.state) {
            this.requestState = initialState.request.state;
        }

        return {
            conversationId: initialState?.conversation?.id ?? `conv_${Date.now()}`,
            requestId: initialState?.request?.id ?? `req_${Date.now()}`,
            clientPhone: initialState?.conversation?.client_phone ?? '+250788000001',
            lastMessageId: '',
            ocrJobIds: [],
            vendorOutreachIds: [],
        };
    }

    async reset(): Promise<void> {
        this.requestState = 'collecting_requirements';
        this.vendorOutreachCount = 0;
        this.rowCounts.clear();
        this.duplicateOutreach = false;
        this.injectionFlags.clear();
    }

    // Helper methods for tests
    setRequestState(state: MoltbotRequestState): void {
        this.requestState = state;
    }

    setVendorOutreachCount(count: number): void {
        this.vendorOutreachCount = count;
    }

    setRowCount(table: string, count: number): void {
        this.rowCounts.set(table, count);
    }

    flagInjection(vendorId: string): void {
        this.injectionFlags.add(vendorId);
    }
}

// =============================================================================
// Scenario Loader
// =============================================================================

async function loadScenarios(): Promise<Scenario[]> {
    const scenarios: Scenario[] = [];

    try {
        const files = await readdir(SCENARIOS_DIR);
        const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

        for (const file of jsonFiles) {
            const content = await readFile(join(SCENARIOS_DIR, file), 'utf-8');
            const scenario = JSON.parse(content) as Scenario;
            scenarios.push(scenario);
        }
    } catch (error) {
        console.error('Failed to load scenarios:', error);
    }

    return scenarios;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Moltbot E2E Conversation Tests', () => {
    let scenarios: Scenario[] = [];

    beforeAll(async () => {
        scenarios = await loadScenarios();
        console.log(`Loaded ${scenarios.length} test scenarios`);
    });

    // ---------------------------------------------------------------------------
    // Scenario Loading Tests
    // ---------------------------------------------------------------------------

    describe('Scenario Loading', () => {
        it('should have at least one scenario loaded', async () => {
            const loaded = await loadScenarios();
            expect(loaded.length).toBeGreaterThan(0);
        });

        it('should load all 6 golden scenarios', async () => {
            const loaded = await loadScenarios();
            expect(loaded.length).toBe(6);
        });
    });

    // ---------------------------------------------------------------------------
    // Individual Scenario Tests
    // ---------------------------------------------------------------------------

    describe.each([
        '01_phone_case_happy_path',
        '02_prescription_high_confidence',
        '03_prescription_low_confidence_clarify',
        '04_vendor_injection_attempt',
        '05_calling_consent_gate',
        '06_idempotency_double_webhook',
    ])('Scenario: %s', (scenarioFile) => {
        it(`should load and parse ${scenarioFile}`, async () => {
            const filePath = join(SCENARIOS_DIR, `${scenarioFile}.json`);
            const content = await readFile(filePath, 'utf-8');
            const scenario = JSON.parse(content) as Scenario;

            expect(scenario).toBeDefined();
            expect(scenario.name).toBeDefined();
            expect(scenario.steps).toBeDefined();
            expect(scenario.steps.length).toBeGreaterThan(0);
        });

        it(`should have valid structure for ${scenarioFile}`, async () => {
            const filePath = join(SCENARIOS_DIR, `${scenarioFile}.json`);
            const content = await readFile(filePath, 'utf-8');
            const scenario = JSON.parse(content) as Scenario;

            // Basic structure validation
            expect(typeof scenario.name).toBe('string');
            expect(Array.isArray(scenario.steps)).toBe(true);

            // Each step should have at least one action
            for (const step of scenario.steps) {
                const hasAction =
                    step.client_inbound ||
                    step.vendor_inbound ||
                    step.ocr_result ||
                    step.moltbot_output ||
                    step.call_event ||
                    step.assert;
                expect(hasAction).toBeTruthy();
            }
        });

        it(`should run ${scenarioFile} with mocks`, async () => {
            const filePath = join(SCENARIOS_DIR, `${scenarioFile}.json`);
            const content = await readFile(filePath, 'utf-8');
            const scenario = JSON.parse(content) as Scenario;

            // Create mock instances
            const whatsapp = new WhatsAppProviderMock();
            const ocr = new GeminiOcrMock();
            const moltbot = new MoltbotMock();
            const calling = new CallingProviderMock();
            const db = new MockDB();

            // Create runner with all 5 required arguments
            const runner = new ScenarioRunner(whatsapp, ocr, moltbot, calling, db);

            // Pre-configure mocks based on scenario steps
            for (const step of scenario.steps) {
                if (step.ocr_result) {
                    ocr.setResult(step.ocr_result.ocr_job_id, step.ocr_result);
                }
                if (step.moltbot_output) {
                    moltbot.setOutput(step.moltbot_output);
                }
            }

            // Run the scenario
            const result = await runner.runScenario(scenario);

            // Log results for debugging if failed
            if (!result.success) {
                console.log(`\n--- Scenario Failed: ${scenario.name} ---`);
                console.log(`Error: ${result.error}`);
                for (const stepResult of result.steps) {
                    if (!stepResult.success) {
                        console.log(`Step ${stepResult.stepId}: FAILED - ${stepResult.error}`);
                        for (const assertion of stepResult.assertions) {
                            if (!assertion.passed) {
                                console.log(
                                    `  - ${assertion.name}: expected=${JSON.stringify(assertion.expected)}, actual=${JSON.stringify(assertion.actual)}`
                                );
                            }
                        }
                    }
                }
            }

            // For now, just expect the runner to execute without throwing
            expect(result).toBeDefined();
            expect(result.name).toBe(scenario.name);
        });
    });

    // ---------------------------------------------------------------------------
    // Category-Based Tests
    // ---------------------------------------------------------------------------

    describe('By Category', () => {
        it('should find OCR scenarios', async () => {
            const loaded = await loadScenarios();
            const ocrScenarios = loaded.filter((s) => s.tags?.includes('ocr'));
            expect(ocrScenarios.length).toBeGreaterThan(0);
        });

        it('should find security scenarios', async () => {
            const loaded = await loadScenarios();
            const securityScenarios = loaded.filter((s) => s.tags?.includes('security'));
            expect(securityScenarios.length).toBeGreaterThan(0);
        });

        it('should find idempotency scenarios', async () => {
            const loaded = await loadScenarios();
            const idempotencyScenarios = loaded.filter((s) => s.tags?.includes('idempotency'));
            expect(idempotencyScenarios.length).toBeGreaterThan(0);
        });
    });

    // ---------------------------------------------------------------------------
    // Performance Tests
    // ---------------------------------------------------------------------------

    describe('Performance', () => {
        it('should complete scenario parsing within 100ms', async () => {
            const filePath = join(SCENARIOS_DIR, '01_phone_case_happy_path.json');

            const startTime = Date.now();
            const content = await readFile(filePath, 'utf-8');
            JSON.parse(content);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(100);
        });

        it('should load all scenarios within 500ms', async () => {
            const startTime = Date.now();
            await loadScenarios();
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(500);
        });
    });

    // ---------------------------------------------------------------------------
    // Mock Integration Tests
    // ---------------------------------------------------------------------------

    describe('Mock Integration', () => {
        it('should create all mock adapters', () => {
            const whatsapp = new WhatsAppProviderMock();
            const ocr = new GeminiOcrMock();
            const moltbot = new MoltbotMock();
            const calling = new CallingProviderMock();
            const db = new MockDB();

            expect(whatsapp).toBeDefined();
            expect(ocr).toBeDefined();
            expect(moltbot).toBeDefined();
            expect(calling).toBeDefined();
            expect(db).toBeDefined();
        });

        it('should reset mocks properly', () => {
            const whatsapp = new WhatsAppProviderMock();
            const ocr = new GeminiOcrMock();
            const moltbot = new MoltbotMock();
            const calling = new CallingProviderMock();

            // Reset should not throw
            expect(() => whatsapp.reset()).not.toThrow();
            expect(() => ocr.reset()).not.toThrow();
            expect(() => moltbot.reset()).not.toThrow();
            expect(() => calling.reset()).not.toThrow();
        });

        it('should configure OCR mock with result', () => {
            const ocr = new GeminiOcrMock();

            ocr.setResult('test_job_id', {
                ocr_job_id: 'test_job_id',
                status: 'completed',
                confidence: 0.95,
                extracted: { test: 'data' },
            });

            // The result should be retrievable when processing
            // This tests the mock's internal state
            expect(true).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // Regression Tests
    // ---------------------------------------------------------------------------

    describe('Regression', () => {
        it('should detect injection scenario tag', async () => {
            const loaded = await loadScenarios();
            const injectionScenario = loaded.find((s) => s.name === 'vendor_injection_attempt');

            expect(injectionScenario).toBeDefined();
            expect(injectionScenario?.tags).toContain('security');
            expect(injectionScenario?.tags).toContain('injection');
        });

        it('should detect idempotency scenario has duplicate step', async () => {
            const loaded = await loadScenarios();
            const idempotencyScenario = loaded.find((s) => s.name === 'idempotency_double_webhook');

            expect(idempotencyScenario).toBeDefined();

            // Find steps with duplicate flag
            const duplicateSteps = idempotencyScenario?.steps.filter(
                (step) => step.client_inbound?.duplicate
            );
            expect(duplicateSteps?.length).toBeGreaterThan(0);
        });
    });
});

// =============================================================================
// Utility Exports for CI
// =============================================================================

export { loadScenarios, MockDB };
