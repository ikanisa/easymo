/**
 * WhatsApp Transport — Start Call
 *
 * Call initiation wrapper with safety gates:
 * 1. CALLING_ENABLED feature flag
 * 2. Valid consent (granted, not expired)
 * 3. Request not in terminal state
 * 4. Cooldown check
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    StartCallInput,
    StartCallOutput,
    CallStatus,
    WhatsAppTransportError,
    getWhatsAppConfig,
} from './types';
import { writeAuditEvent } from '../audit/writeAuditEvent';

// =============================================================================
// Constants
// =============================================================================

const COOLDOWN_MINUTES = 10;
const CONSENT_EXPIRY_MINUTES = 30;

// =============================================================================
// Main Function
// =============================================================================

/**
 * Initiate a WhatsApp call with full safety gate checks.
 *
 * @param supabase - Supabase client
 * @param input - Call input parameters
 * @param options - Optional overrides for testing
 * @returns Call output with attempt ID
 */
export async function initiateCall(
    supabase: SupabaseClient,
    input: StartCallInput,
    options?: {
        skipFlagCheck?: boolean;
    }
): Promise<StartCallOutput> {
    const { to_phone, purpose, consent_id, idempotency_key, request_id } = input;

    // =========================================================================
    // Gate 1: Feature Flag
    // =========================================================================
    if (!options?.skipFlagCheck) {
        const { data: flag } = await supabase
            .from('moltbot_feature_flags')
            .select('value')
            .eq('name', 'CALLING_ENABLED')
            .single();

        if (!flag?.value) {
            throw new WhatsAppTransportError('Calling is disabled', 'CALLING_DISABLED');
        }
    }

    // =========================================================================
    // Gate 2: Consent Validation
    // =========================================================================
    const { data: consent, error: consentError } = await supabase
        .from('moltbot_call_consents')
        .select('*')
        .eq('id', consent_id)
        .single();

    if (consentError || !consent) {
        throw new WhatsAppTransportError('Consent not found', 'NO_CONSENT');
    }

    if (consent.state === 'denied') {
        throw new WhatsAppTransportError('Consent was denied', 'NO_CONSENT');
    }

    if (consent.state !== 'granted') {
        throw new WhatsAppTransportError(`Invalid consent state: ${consent.state}`, 'NO_CONSENT');
    }

    // Check expiration
    if (consent.expires_at && new Date(consent.expires_at) < new Date()) {
        await supabase
            .from('moltbot_call_consents')
            .update({ state: 'expired' })
            .eq('id', consent_id);

        throw new WhatsAppTransportError('Consent has expired', 'CONSENT_EXPIRED');
    }

    // =========================================================================
    // Gate 3: Request State
    // =========================================================================
    const { data: request } = await supabase
        .from('moltbot_marketplace_requests')
        .select('state')
        .eq('id', request_id)
        .single();

    const terminalStates = ['handed_off', 'closed', 'error'];
    if (request && terminalStates.includes(request.state)) {
        throw new WhatsAppTransportError(
            `Cannot call when request is in ${request.state} state`,
            'CALLING_DISABLED'
        );
    }

    // =========================================================================
    // Gate 4: Cooldown Check
    // =========================================================================
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

    const { data: recentAttempts } = await supabase
        .from('moltbot_call_attempts')
        .select('id')
        .eq('consent_id', consent_id)
        .gte('initiated_at', cooldownCutoff);

    if (recentAttempts && recentAttempts.length > 0) {
        throw new WhatsAppTransportError(
            `Cooldown active. Max 1 call per ${COOLDOWN_MINUTES} minutes.`,
            'CALLING_DISABLED'
        );
    }

    // =========================================================================
    // Gate 5: Idempotency Check
    // =========================================================================
    const { data: existingAttempt } = await supabase
        .from('moltbot_call_attempts')
        .select('id, provider_call_id, status')
        .eq('idempotency_key', idempotency_key)
        .maybeSingle();

    if (existingAttempt) {
        return {
            success: existingAttempt.status !== 'failed',
            provider_call_id: existingAttempt.provider_call_id,
            call_attempt_id: existingAttempt.id,
        };
    }

    // =========================================================================
    // Create Call Attempt
    // =========================================================================
    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await supabase
        .from('moltbot_call_attempts')
        .insert({
            consent_id,
            status: 'initiated' as CallStatus,
            initiated_at: now,
            idempotency_key,
            purpose,
        })
        .select('id')
        .single();

    if (attemptError) {
        throw new WhatsAppTransportError(
            `Failed to create call attempt: ${attemptError.message}`,
            'CALL_FAILED'
        );
    }

    // =========================================================================
    // Call Meta API
    // =========================================================================
    let providerCallId: string | undefined;

    try {
        providerCallId = await callMetaApi(to_phone);

        // Update attempt with provider ID
        await supabase
            .from('moltbot_call_attempts')
            .update({ provider_call_id: providerCallId, status: 'ringing' })
            .eq('id', attempt.id);

        // Audit success
        await writeAuditEvent({
            request_id,
            event_type: 'whatsapp.call_initiated',
            actor: 'system',
            input: { to_phone, consent_id, purpose },
            output: { call_attempt_id: attempt.id, provider_call_id: providerCallId },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark attempt as failed
        await supabase
            .from('moltbot_call_attempts')
            .update({
                status: 'failed',
                error_message: errorMessage,
                ended_at: new Date().toISOString(),
            })
            .eq('id', attempt.id);

        // Audit failure
        await writeAuditEvent({
            request_id,
            event_type: 'whatsapp.call_failed',
            actor: 'system',
            input: { to_phone, consent_id },
            output: { error: errorMessage, call_attempt_id: attempt.id },
        });

        throw new WhatsAppTransportError(`Call initiation failed: ${errorMessage}`, 'CALL_FAILED', true);
    }

    return {
        success: true,
        provider_call_id: providerCallId,
        call_attempt_id: attempt.id,
    };
}

// =============================================================================
// Meta API Caller
// =============================================================================

async function callMetaApi(toPhone: string): Promise<string> {
    const config = getWhatsAppConfig();

    if (!config.accessToken || !config.phoneNumberId) {
        throw new WhatsAppTransportError(
            'WhatsApp API not configured',
            'CALL_FAILED'
        );
    }

    const url = `${config.apiUrl}/${config.phoneNumberId}/calls`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toPhone,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new WhatsAppTransportError(
            `Meta API error (${response.status}): ${errorText}`,
            'CALL_FAILED'
        );
    }

    const data = await response.json() as { call_id: string };

    if (!data.call_id) {
        throw new WhatsAppTransportError('No call_id in Meta response', 'CALL_FAILED');
    }

    return data.call_id;
}

// =============================================================================
// Export Constants
// =============================================================================

export { COOLDOWN_MINUTES, CONSENT_EXPIRY_MINUTES };
