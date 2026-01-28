/**
 * Calling Provider Mock
 * 
 * Mock adapter for simulating Meta WhatsApp Business Calling API.
 * Handles consent capture and call initiation/status.
 */

import type { CallingMockAdapter, CallEvent, ScenarioContext } from '../e2e/scenario-runner';

// =============================================================================
// Types
// =============================================================================

export type ConsentState = 'not_requested' | 'requested' | 'granted' | 'denied' | 'expired';
export type CallStatus = 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed' | 'no_answer' | 'busy';

export interface ConsentRecord {
    id: string;
    conversationId: string;
    state: ConsentState;
    scope: string;
    requestedAt?: string;
    grantedAt?: string;
    deniedAt?: string;
    expiresAt?: string;
}

export interface CallAttempt {
    id: string;
    consentId: string;
    status: CallStatus;
    initiatedAt: string;
    answeredAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    errorMessage?: string;
}

export interface CallingMockConfig {
    autoGrantConsent?: boolean;
    callSuccessRate?: number;
    defaultCallDuration?: number;
}

// =============================================================================
// Calling Provider Mock Implementation
// =============================================================================

export class CallingProviderMock implements CallingMockAdapter {
    private consents: Map<string, ConsentRecord> = new Map();
    private calls: Map<string, CallAttempt> = new Map();
    private callRefused: boolean = false;
    private callIdCounter: number = 0;

    constructor(private config: CallingMockConfig = {}) { }

    // ==========================================================================
    // CallingMockAdapter Interface
    // ==========================================================================

    async handleEvent(event: CallEvent, context: ScenarioContext): Promise<boolean> {
        switch (event.event_type) {
            case 'consent_request':
                return this.requestConsent(context);

            case 'consent_granted':
                return this.grantConsent(event.consent_id ?? context.consentId ?? '');

            case 'consent_denied':
                return this.denyConsent(event.consent_id ?? context.consentId ?? '');

            case 'call_initiated':
                return this.initiateCall(event.consent_id ?? context.consentId ?? '');

            case 'call_completed':
                return this.completeCall(event.call_id ?? '');

            case 'call_failed':
                return this.failCall(event.call_id ?? '', 'Call failed');

            default:
                return false;
        }
    }

    isCallRefused(): boolean {
        return this.callRefused;
    }

    reset(): void {
        this.consents.clear();
        this.calls.clear();
        this.callRefused = false;
        this.callIdCounter = 0;
    }

    // ==========================================================================
    // Consent Management
    // ==========================================================================

    private requestConsent(context: ScenarioContext): boolean {
        const consentId = `consent_${Date.now()}`;
        const consent: ConsentRecord = {
            id: consentId,
            conversationId: context.conversationId,
            state: 'requested',
            scope: 'marketplace_assistance',
            requestedAt: new Date().toISOString(),
        };

        this.consents.set(consentId, consent);
        context.consentId = consentId;

        // Auto-grant if configured
        if (this.config.autoGrantConsent) {
            this.grantConsent(consentId);
        }

        return true;
    }

    private grantConsent(consentId: string): boolean {
        const consent = this.consents.get(consentId);
        if (!consent) return false;

        consent.state = 'granted';
        consent.grantedAt = new Date().toISOString();
        consent.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        this.callRefused = false;
        return true;
    }

    private denyConsent(consentId: string): boolean {
        const consent = this.consents.get(consentId);
        if (!consent) {
            // Create a denied consent record
            this.consents.set(consentId, {
                id: consentId,
                conversationId: '',
                state: 'denied',
                scope: 'marketplace_assistance',
                deniedAt: new Date().toISOString(),
            });
        } else {
            consent.state = 'denied';
            consent.deniedAt = new Date().toISOString();
        }

        this.callRefused = true;
        return true;
    }

    // ==========================================================================
    // Call Management
    // ==========================================================================

    private initiateCall(consentId: string): boolean {
        const consent = this.consents.get(consentId);

        // Check consent
        if (!consent || consent.state !== 'granted') {
            this.callRefused = true;
            return false;
        }

        // Check if expired
        if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
            consent.state = 'expired';
            this.callRefused = true;
            return false;
        }

        this.callIdCounter++;
        const callId = `call_${this.callIdCounter}_${Date.now()}`;

        const call: CallAttempt = {
            id: callId,
            consentId,
            status: 'initiated',
            initiatedAt: new Date().toISOString(),
        };

        this.calls.set(callId, call);
        this.callRefused = false;

        // Simulate call success/failure based on config
        if (this.config.callSuccessRate !== undefined) {
            if (Math.random() < this.config.callSuccessRate) {
                this.simulateCallSuccess(callId);
            } else {
                this.failCall(callId, 'No answer');
            }
        }

        return true;
    }

    private simulateCallSuccess(callId: string): void {
        const call = this.calls.get(callId);
        if (!call) return;

        call.status = 'answered';
        call.answeredAt = new Date().toISOString();

        // Simulate call completion
        setTimeout(() => {
            this.completeCall(callId);
        }, 100);
    }

    private completeCall(callId: string): boolean {
        const call = this.calls.get(callId);
        if (!call) return false;

        call.status = 'completed';
        call.endedAt = new Date().toISOString();
        call.durationSeconds = this.config.defaultCallDuration ?? 60;

        return true;
    }

    private failCall(callId: string, reason: string): boolean {
        const call = this.calls.get(callId);
        if (!call) {
            // Create a failed call record
            this.calls.set(callId, {
                id: callId,
                consentId: '',
                status: 'failed',
                initiatedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                errorMessage: reason,
            });
        } else {
            call.status = 'failed';
            call.endedAt = new Date().toISOString();
            call.errorMessage = reason;
        }

        return true;
    }

    // ==========================================================================
    // Inspection
    // ==========================================================================

    /**
     * Get all consent records
     */
    getConsents(): ConsentRecord[] {
        return [...this.consents.values()];
    }

    /**
     * Get a specific consent
     */
    getConsent(consentId: string): ConsentRecord | undefined {
        return this.consents.get(consentId);
    }

    /**
     * Get all call attempts
     */
    getCalls(): CallAttempt[] {
        return [...this.calls.values()];
    }

    /**
     * Get a specific call
     */
    getCall(callId: string): CallAttempt | undefined {
        return this.calls.get(callId);
    }

    /**
     * Check if any call was made
     */
    hasAnyCalls(): boolean {
        return this.calls.size > 0;
    }

    /**
     * Check if all calls were refused (no granted consent)
     */
    allCallsRefused(): boolean {
        return this.callRefused && this.calls.size === 0;
    }

    /**
     * Get count of successful calls
     */
    getSuccessfulCallCount(): number {
        return [...this.calls.values()].filter(c => c.status === 'completed').length;
    }
}

// =============================================================================
// Factory
// =============================================================================

export function createCallingMock(config?: CallingMockConfig): CallingProviderMock {
    return new CallingProviderMock(config);
}
