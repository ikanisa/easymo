/**
 * Moltbot Mock
 * 
 * Mock adapter for simulating Moltbot AI responses.
 * Returns deterministic outputs validated against the output contract.
 */

import {
    type MoltbotOutputAction,
    type MoltbotContextPack,
    type MoltbotActionAskClient,
    type MoltbotActionVendorOutreachPlan,
    type MoltbotActionShortlist,
    type MoltbotActionEscalate,
    validateMoltbotOutput,
} from '@easymo/types';
import type { MoltbotMockAdapter } from '../e2e/scenario-runner';

// =============================================================================
// Types
// =============================================================================

export interface MoltbotMockConfig {
    validateOutputs?: boolean;
    defaultAction?: MoltbotOutputAction;
}

// =============================================================================
// Moltbot Mock Implementation
// =============================================================================

export class MoltbotMock implements MoltbotMockAdapter {
    private currentOutput: MoltbotOutputAction | null = null;
    private lastContextPack: MoltbotContextPack | null = null;
    private invocations: Array<{ context: MoltbotContextPack; output: MoltbotOutputAction }> = [];

    constructor(private config: MoltbotMockConfig = { validateOutputs: true }) { }

    // ==========================================================================
    // MoltbotMockAdapter Interface
    // ==========================================================================

    setOutput(output: MoltbotOutputAction): void {
        if (this.config.validateOutputs) {
            const validation = validateMoltbotOutput(output);
            if (!validation.valid) {
                throw new Error(`Invalid Moltbot output: ${validation.error}`);
            }
        }
        this.currentOutput = output;
    }

    getLastContextPack(): MoltbotContextPack | null {
        return this.lastContextPack;
    }

    reset(): void {
        this.currentOutput = null;
        this.lastContextPack = null;
        this.invocations = [];
    }

    // ==========================================================================
    // Invocation
    // ==========================================================================

    /**
     * Simulate invoking Moltbot with a context pack
     */
    async invoke(contextPack: MoltbotContextPack): Promise<MoltbotOutputAction> {
        this.lastContextPack = contextPack;

        const output = this.currentOutput ?? this.config.defaultAction ?? this.generateDefaultOutput(contextPack);

        this.invocations.push({ context: contextPack, output });

        return output;
    }

    /**
     * Generate a sensible default output based on context
     */
    private generateDefaultOutput(context: MoltbotContextPack): MoltbotOutputAction {
        switch (context.request_state) {
            case 'collecting_requirements':
                return MOLTBOT_ACTIONS.askForDetails();

            case 'ocr_processing':
                return MOLTBOT_ACTIONS.askForClarification(
                    'We are processing your image. Please hold on.',
                );

            case 'vendor_outreach':
            case 'awaiting_vendor_replies':
                return MOLTBOT_ACTIONS.escalate('Waiting for vendor responses');

            case 'shortlist_ready':
                return MOLTBOT_ACTIONS.emptyShortlist();

            default:
                return MOLTBOT_ACTIONS.askForDetails();
        }
    }

    // ==========================================================================
    // Inspection
    // ==========================================================================

    /**
     * Get all invocations
     */
    getInvocations(): Array<{ context: MoltbotContextPack; output: MoltbotOutputAction }> {
        return [...this.invocations];
    }

    /**
     * Get invocation count
     */
    getInvocationCount(): number {
        return this.invocations.length;
    }

    /**
     * Check if Moltbot produced a specific action type
     */
    hasProducedActionType(type: MoltbotOutputAction['type']): boolean {
        return this.invocations.some(inv => inv.output.type === type);
    }
}

// =============================================================================
// Pre-defined Moltbot Actions
// =============================================================================

export const MOLTBOT_ACTIONS = {
    /**
     * Ask client for more details
     */
    askForDetails: (question?: string): MoltbotActionAskClient => ({
        type: 'ask_client',
        question_text: question ?? 'Could you please provide more details about what you need?',
        why: 'Need more information to proceed with vendor search',
        options: ['Electronics', 'Medication', 'Groceries', 'Services'],
    }),

    /**
     * Ask for clarification
     */
    askForClarification: (question: string, options?: string[]): MoltbotActionAskClient => ({
        type: 'ask_client',
        question_text: question,
        why: 'Clarification needed',
        options,
    }),

    /**
     * Low confidence OCR clarification
     */
    askOcrClarification: (): MoltbotActionAskClient => ({
        type: 'ask_client',
        question_text: 'We had trouble reading your image. Could you please send a clearer photo or type out the details?',
        why: 'OCR confidence below threshold',
        state_suggestion: 'collecting_requirements',
    }),

    /**
     * Vendor outreach plan for phone accessories
     */
    vendorOutreachPhoneCase: (details?: Partial<MoltbotActionVendorOutreachPlan>): MoltbotActionVendorOutreachPlan => ({
        type: 'vendor_outreach_plan',
        category: 'electronics',
        normalized_need: 'phone case',
        vendor_filters: {
            tags: ['electronics', 'phone_accessories'],
        },
        batch_size: 5,
        vendor_questions: [
            'Do you have phone cases in stock?',
            'What models are available?',
            'What is the price range?',
        ],
        stop_conditions: {
            max_vendors: 10,
            min_replies: 3,
            timeout_hours: 2,
        },
        calling_allowed: false,
        ...details,
    }),

    /**
     * Vendor outreach plan for pharmacy
     */
    vendorOutreachPharmacy: (medications: string[]): MoltbotActionVendorOutreachPlan => ({
        type: 'vendor_outreach_plan',
        category: 'pharmacy',
        normalized_need: `medication: ${medications.join(', ')}`,
        vendor_filters: {
            tags: ['pharmacy', 'medical'],
        },
        batch_size: 5,
        vendor_questions: [
            `Do you have the following in stock: ${medications.join(', ')}?`,
            'What is the total price?',
            'Is a prescription required for pickup?',
        ],
        stop_conditions: {
            max_vendors: 15,
            min_replies: 3,
            timeout_hours: 4,
        },
        calling_allowed: true,
    }),

    /**
     * Shortlist with vendors
     */
    shortlist: (
        items: Array<{
            vendor_id: string;
            vendor_name: string;
            vendor_phone: string;
            response_summary: string;
            price?: number;
        }>,
        summary?: string,
    ): MoltbotActionShortlist => ({
        type: 'shortlist',
        summary_text: summary ?? `Found ${items.length} options for you.`,
        items,
        handoff: {
            type: 'wa_link',
            message_template: 'Hi, I found you through EasyMO marketplace.',
        },
    }),

    /**
     * Empty shortlist (no vendors found)
     */
    emptyShortlist: (): MoltbotActionShortlist => ({
        type: 'shortlist',
        summary_text: 'Sorry, no vendors with availability were found.',
        items: [],
        handoff: {
            type: 'wa_link',
        },
    }),

    /**
     * Escalate to human
     */
    escalate: (reason: string, message?: string): MoltbotActionEscalate => ({
        type: 'escalate',
        reason,
        safe_client_message: message ?? 'We are connecting you with a human agent for better assistance.',
        to: 'human',
    }),

    /**
     * Escalate due to injection attempt
     */
    escalateInjection: (): MoltbotActionEscalate => ({
        type: 'escalate',
        reason: 'Potential security concern detected in vendor response',
        safe_client_message: 'We noticed something unusual. Our team will review this shortly.',
        to: 'human',
        state_suggestion: 'error',
    }),
};

// =============================================================================
// Factory
// =============================================================================

export function createMoltbotMock(config?: MoltbotMockConfig): MoltbotMock {
    return new MoltbotMock(config);
}
