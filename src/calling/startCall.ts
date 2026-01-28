/**
 * Start Call Tool
 *
 * Tool: marketplace.start_call
 *
 * Initiate a WhatsApp call with strict safety gates:
 * 1. CALLING_ENABLED feature flag
 * 2. Request state not terminal
 * 3. Consent granted and not expired
 * 4. Cooldown check (max 1 call per 10 min)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    StartCallInput,
    StartCallOutput,
    CallConsentRecord,
    CallAttemptStatus,
    CallingError,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const COOLDOWN_MINUTES = 10;

// =============================================================================
// Main Tool Implementation
// =============================================================================

/**
 * Start a WhatsApp call after verifying all safety gates.
 */
export async function startCall(
    supabase: SupabaseClient,
    input: StartCallInput,
    options?: {
        skipFlagCheck?: boolean; // For testing
    }
): Promise<StartCallOutput> {
    const { consent_id, target_phone } = input;

    // =========================================================================
    // Gate 1: Feature flag check
    // =========================================================================
    if (!options?.skipFlagCheck) {
        const callingEnabled = await checkCallingEnabled(supabase);
        if (!callingEnabled) {
            throw new CallingError('Calling is disabled', 'CALLING_DISABLED');
        }
    }

    // =========================================================================
    // Gate 2: Get consent and validate
    // =========================================================================
    const { data: consent, error: consentError } = await supabase
        .from('moltbot_call_consents')
        .select('*')
        .eq('id', consent_id)
        .single();

    if (consentError || !consent) {
        throw new CallingError('Consent not found', 'NO_CONSENT');
    }

    const consentRecord = consent as CallConsentRecord;

    // Check consent state
    if (consentRecord.state === 'denied') {
        throw new CallingError('Call consent was denied', 'CONSENT_DENIED');
    }

    if (consentRecord.state !== 'granted') {
        throw new CallingError(
            `Invalid consent state: ${consentRecord.state}`,
            'NO_CONSENT'
        );
    }

    // Check expiration
    if (consentRecord.expires_at && new Date(consentRecord.expires_at) < new Date()) {
        // Update state to expired
        await supabase
            .from('moltbot_call_consents')
            .update({ state: 'expired' })
            .eq('id', consent_id);

        throw new CallingError('Consent has expired', 'CONSENT_EXPIRED');
    }

    // =========================================================================
    // Gate 3: Request state check
    // =========================================================================
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('id, client_phone')
        .eq('id', consentRecord.conversation_id)
        .single();

    if (!conversation) {
        throw new CallingError('Conversation not found', 'INVALID_STATE');
    }

    // Check if any request in terminal state
    const { data: requests } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id, state')
        .eq('conversation_id', consentRecord.conversation_id)
        .in('state', ['handed_off', 'closed', 'error']);

    if (requests && requests.length > 0) {
        throw new CallingError(
            'Cannot call when request is in terminal state',
            'INVALID_STATE'
        );
    }

    // =========================================================================
    // Gate 4: Cooldown check
    // =========================================================================
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

    const { data: recentAttempts } = await supabase
        .from('moltbot_call_attempts')
        .select('id')
        .eq('consent_id', consent_id)
        .gte('initiated_at', cooldownCutoff);

    if (recentAttempts && recentAttempts.length > 0) {
        throw new CallingError(
            `Cooldown active. Max 1 call per ${COOLDOWN_MINUTES} minutes.`,
            'COOLDOWN_ACTIVE',
            true // Retryable after cooldown
        );
    }

    // =========================================================================
    // Gate 5: No concurrent call
    // =========================================================================
    const { data: activeCall } = await supabase
        .from('moltbot_call_attempts')
        .select('id')
        .eq('consent_id', consent_id)
        .in('status', ['initiated', 'ringing'])
        .maybeSingle();

    if (activeCall) {
        throw new CallingError('Already in a call', 'ALREADY_IN_CALL');
    }

    // =========================================================================
    // Execute: Create call attempt
    // =========================================================================
    const phoneNumber = target_phone || conversation.client_phone;
    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await supabase
        .from('moltbot_call_attempts')
        .insert({
            consent_id: consent_id,
            status: 'initiated' as CallAttemptStatus,
            initiated_at: now,
        })
        .select('id')
        .single();

    if (attemptError) {
        throw new CallingError(`Failed to create call attempt: ${attemptError.message}`, 'PROVIDER_ERROR');
    }

    // =========================================================================
    // Execute: Call Meta API
    // =========================================================================
    let providerCallId: string | undefined;

    try {
        // Get active request_id for audit logging
        const { data: activeRequest } = await supabase
            .from('moltbot_marketplace_requests')
            .select('id')
            .eq('conversation_id', consentRecord.conversation_id)
            .not('state', 'in', '(handed_off,closed,error)')
            .limit(1)
            .single();

        const requestId = activeRequest?.id || 'unknown';

        providerCallId = await initiateWhatsAppCall(supabase, phoneNumber, consent_id, requestId);
        await supabase
            .from('moltbot_call_attempts')
            .update({ provider_call_id: providerCallId, status: 'ringing' })
            .eq('id', attempt.id);

    } catch (error) {
        // Mark attempt as failed
        const errorMessage = error instanceof Error ? error.message : String(error);
        await supabase
            .from('moltbot_call_attempts')
            .update({ status: 'failed', error_message: errorMessage, ended_at: new Date().toISOString() })
            .eq('id', attempt.id);

        throw new CallingError(`Call initiation failed: ${errorMessage}`, 'PROVIDER_ERROR', true);
    }

    return {
        success: true,
        call_attempt_id: attempt.id,
        provider_call_id: providerCallId,
    };
}

// =============================================================================
// Helpers
// =============================================================================

async function checkCallingEnabled(supabase: SupabaseClient): Promise<boolean> {
    const { data } = await supabase
        .from('moltbot_feature_flags')
        .select('value')
        .eq('name', 'CALLING_ENABLED')
        .single();

    return data?.value === true;
}

async function initiateWhatsAppCall(
    supabase: SupabaseClient,
    phoneNumber: string,
    consentId: string,
    requestId: string
): Promise<string> {
    // Use the transport module for actual Meta API call
    const { initiateCall } = await import('../whatsapp');

    const result = await initiateCall(supabase, {
        to_phone: phoneNumber,
        purpose: 'marketplace_call',
        consent_id: consentId,
        idempotency_key: `call:${consentId}:${Date.now()}`,
        request_id: requestId,
    });

    if (!result.provider_call_id) {
        throw new Error('No provider_call_id returned');
    }

    return result.provider_call_id;
}

// =============================================================================
// Exports
// =============================================================================

export { COOLDOWN_MINUTES };
