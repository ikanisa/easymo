/**
 * Request Call Consent Tool
 *
 * Tool: marketplace.request_call_consent
 *
 * Request permission from the client to place a WhatsApp call.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    RequestCallConsentInput,
    RequestCallConsentOutput,
    CallScope,
    CallingError,
} from './types';
import { sendConsentPrompt as sendWhatsAppConsentPrompt } from '../whatsapp';

// =============================================================================
// Consent Request Templates
// =============================================================================

const CONSENT_PROMPTS: Record<string, Record<CallScope, string>> = {
    en: {
        call_client: "To speed this up, I can place a quick WhatsApp call to clarify details.\nDo you allow me to call you for this request?\n\nReply: YES or NO",
        call_vendor: "I may need to call a vendor to confirm availability.\nDo you allow me to place calls on your behalf for this request?\n\nReply: YES or NO",
        either: "To speed this up, I may need to make some calls.\nDo you allow calls for this request?\n\nReply: YES or NO",
        concierge: "To help you faster, I can place a WhatsApp call.\nDo you allow a call for this request?\n\nReply: YES or NO",
    },
    fr: {
        call_client: "Pour aller plus vite, je peux vous appeler sur WhatsApp pour clarifier.\nM'autorisez-vous à vous appeler pour cette demande ?\n\nRépondez: OUI ou NON",
        call_vendor: "Je pourrais appeler un fournisseur pour confirmer la disponibilité.\nM'autorisez-vous à passer des appels pour cette demande ?\n\nRépondez: OUI ou NON",
        either: "Pour aller plus vite, je pourrais passer des appels.\nM'autorisez-vous à appeler pour cette demande ?\n\nRépondez: OUI ou NON",
        concierge: "Pour vous aider plus vite, je peux passer un appel WhatsApp.\nM'autorisez-vous à appeler ?\n\nRépondez: OUI ou NON",
    },
    rw: {
        call_client: "Kugirango tugende vuba, nshobora kukuhamagara kuri WhatsApp.\nWemera ko nguhmagara?\n\nSubiza: YEGO cyangwa OYA",
        call_vendor: "Nshobora guhamagara umucuruzi kugirango mmenye.\nWemera ko ndahamagara?\n\nSubiza: YEGO cyangwa OYA",
        either: "Kugirango tugende vuba, nshobora guhamagara.\nWemera amahamagare?\n\nSubiza: YEGO cyangwa OYA",
        concierge: "Kugirango ngufashe vuba, nshobora guhamagara kuri WhatsApp.\nWemera?\n\nSubiza: YEGO cyangwa OYA",
    },
};

// =============================================================================
// Main Tool Implementation
// =============================================================================

/**
 * Request call consent from the client.
 *
 * Creates or updates a consent record in 'requested' state
 * and sends a consent prompt message.
 */
export async function requestCallConsent(
    supabase: SupabaseClient,
    input: RequestCallConsentInput
): Promise<RequestCallConsentOutput> {
    const { request_id, scope, reason } = input;

    // Validate request state
    const { data: request, error: requestError } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id, conversation_id, state')
        .eq('id', request_id)
        .single();

    if (requestError || !request) {
        throw new CallingError('Request not found', 'INVALID_STATE');
    }

    // Cannot request consent for terminal states
    const terminalStates = ['handed_off', 'closed', 'error'];
    if (terminalStates.includes(request.state)) {
        throw new CallingError(
            `Cannot request consent in ${request.state} state`,
            'INVALID_STATE'
        );
    }

    // Check for existing pending consent
    const { data: existingConsent } = await supabase
        .from('moltbot_call_consents')
        .select('id, state')
        .eq('conversation_id', request.conversation_id)
        .eq('state', 'requested')
        .maybeSingle();

    if (existingConsent) {
        // Already pending — return existing consent
        return {
            consent_id: existingConsent.id,
            state: 'requested',
            message_sent: false, // Don't spam
        };
    }

    // Get conversation language
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('language')
        .eq('id', request.conversation_id)
        .single();

    const language = conversation?.language || 'en';
    const now = new Date().toISOString();

    // Create or update consent record
    const { data: consent, error: consentError } = await supabase
        .from('moltbot_call_consents')
        .upsert(
            {
                conversation_id: request.conversation_id,
                state: 'requested',
                scope: scope,
                requested_at: now,
            },
            { onConflict: 'conversation_id' }
        )
        .select('id')
        .single();

    if (consentError) {
        console.error('[requestCallConsent] Error creating consent:', consentError);
        return {
            consent_id: '',
            state: 'requested',
            message_sent: false,
            error: consentError.message,
        };
    }

    // Build and send consent prompt via WhatsApp transport
    const promptTemplate = CONSENT_PROMPTS[language]?.[scope] || CONSENT_PROMPTS.en[scope];
    const customReason = reason ? reason : undefined;

    // Get client phone from conversation
    const { data: conversationData } = await supabase
        .from('moltbot_conversations')
        .select('client_phone')
        .eq('id', request.conversation_id)
        .single();

    if (!conversationData?.client_phone) {
        console.warn(`[requestCallConsent] No phone for conversation ${request.conversation_id}`);
        return {
            consent_id: consent.id,
            state: 'requested',
            message_sent: false,
            error: 'No phone number found',
        };
    }

    try {
        const sendResult = await sendWhatsAppConsentPrompt(supabase, {
            conversation_id: request.conversation_id,
            request_id: request_id,
            to_phone: conversationData.client_phone,
            scope,
            language,
            custom_reason: customReason,
        });

        return {
            consent_id: consent.id,
            state: 'requested',
            message_sent: sendResult.message_sent,
            error: sendResult.error,
        };
    } catch (error) {
        console.error('[requestCallConsent] Failed to send consent prompt:', error);
        return {
            consent_id: consent.id,
            state: 'requested',
            message_sent: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
