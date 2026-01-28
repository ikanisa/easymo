/**
 * WhatsApp Transport — Consent Prompt
 *
 * Sends YES/NO consent prompts for calling functionality.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { sendButtonMessage } from './sendMessage';
import { SendMessageOutput, WhatsAppTransportError } from './types';
import { writeAuditEvent } from '../audit/writeAuditEvent';

// =============================================================================
// Types
// =============================================================================

export type CallScope = 'call_client' | 'call_vendor' | 'either' | 'concierge';

export interface SendConsentPromptInput {
    conversation_id: string;
    request_id: string;
    to_phone: string;
    scope: CallScope;
    language?: string;
    custom_reason?: string;
}

export interface SendConsentPromptOutput {
    success: boolean;
    consent_id: string;
    message_sent: boolean;
    error?: string;
}

// =============================================================================
// Consent Templates
// =============================================================================

const CONSENT_PROMPTS: Record<string, Record<CallScope, string>> = {
    en: {
        call_client: "To speed this up, I can place a quick WhatsApp call to clarify details.\nDo you allow me to call you for this request?",
        call_vendor: "I may need to call a vendor to confirm availability.\nDo you allow me to place calls on your behalf for this request?",
        either: "To speed this up, I may need to make some calls.\nDo you allow calls for this request?",
        concierge: "To help you faster, I can place a WhatsApp call.\nDo you allow a call for this request?",
    },
    fr: {
        call_client: "Pour aller plus vite, je peux vous appeler sur WhatsApp pour clarifier.\nM'autorisez-vous à vous appeler pour cette demande ?",
        call_vendor: "Je pourrais appeler un fournisseur pour confirmer la disponibilité.\nM'autorisez-vous à passer des appels pour cette demande ?",
        either: "Pour aller plus vite, je pourrais passer des appels.\nM'autorisez-vous à appeler pour cette demande ?",
        concierge: "Pour vous aider plus vite, je peux passer un appel WhatsApp.\nM'autorisez-vous à appeler ?",
    },
    rw: {
        call_client: "Kugirango tugende vuba, nshobora kukuhamagara kuri WhatsApp.\nWemera ko nguhmagara?",
        call_vendor: "Nshobora guhamagara umucuruzi kugirango mmenye.\nWemera ko ndahamagara?",
        either: "Kugirango tugende vuba, nshobora guhamagara.\nWemera amahamagare?",
        concierge: "Kugirango ngufashe vuba, nshobora guhamagara kuri WhatsApp.\nWemera?",
    },
};

const CONSENT_BUTTONS = {
    en: [
        { id: 'consent_yes', title: 'YES' },
        { id: 'consent_no', title: 'NO' },
    ],
    fr: [
        { id: 'consent_yes', title: 'OUI' },
        { id: 'consent_no', title: 'NON' },
    ],
    rw: [
        { id: 'consent_yes', title: 'YEGO' },
        { id: 'consent_no', title: 'OYA' },
    ],
};

// =============================================================================
// Main Function
// =============================================================================

/**
 * Send a consent prompt for calling.
 *
 * Creates a consent record in 'requested' state and sends an interactive
 * button message with YES/NO options.
 */
export async function sendConsentPrompt(
    supabase: SupabaseClient,
    input: SendConsentPromptInput
): Promise<SendConsentPromptOutput> {
    const { conversation_id, request_id, to_phone, scope, language = 'en', custom_reason } = input;

    // =========================================================================
    // Check for existing pending consent
    // =========================================================================
    const { data: existingConsent } = await supabase
        .from('moltbot_call_consents')
        .select('id, state')
        .eq('conversation_id', conversation_id)
        .eq('state', 'requested')
        .maybeSingle();

    if (existingConsent) {
        // Already pending — don't spam
        return {
            success: true,
            consent_id: existingConsent.id,
            message_sent: false,
        };
    }

    // =========================================================================
    // Create consent record
    // =========================================================================
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    const { data: consent, error: consentError } = await supabase
        .from('moltbot_call_consents')
        .upsert(
            {
                conversation_id,
                state: 'requested',
                scope,
                requested_at: new Date().toISOString(),
                expires_at: expiresAt,
            },
            { onConflict: 'conversation_id' }
        )
        .select('id')
        .single();

    if (consentError || !consent) {
        return {
            success: false,
            consent_id: '',
            message_sent: false,
            error: consentError?.message || 'Failed to create consent record',
        };
    }

    // =========================================================================
    // Build and send message
    // =========================================================================
    const lang = CONSENT_PROMPTS[language] ? language : 'en';
    const promptText = CONSENT_PROMPTS[lang][scope] || CONSENT_PROMPTS.en[scope];
    const fullText = custom_reason ? `${custom_reason}\n\n${promptText}` : promptText;
    const buttons = CONSENT_BUTTONS[lang as keyof typeof CONSENT_BUTTONS] || CONSENT_BUTTONS.en;

    let messageSent = false;

    try {
        await sendButtonMessage(
            supabase,
            conversation_id,
            request_id,
            to_phone,
            fullText,
            buttons
        );
        messageSent = true;

        // Audit consent request
        await writeAuditEvent({
            request_id,
            event_type: 'whatsapp.consent_requested',
            actor: 'system',
            input: { scope, language: lang },
            output: { consent_id: consent.id, message_sent: true },
        });
    } catch (error) {
        // Update consent record to reflect send failure
        await supabase
            .from('moltbot_call_consents')
            .update({ state: 'expired' }) // Mark as expired since prompt wasn't delivered
            .eq('id', consent.id);

        await writeAuditEvent({
            request_id,
            event_type: 'whatsapp.consent_send_failed',
            actor: 'system',
            input: { scope, consent_id: consent.id },
            output: { error: error instanceof Error ? error.message : String(error) },
        });

        return {
            success: false,
            consent_id: consent.id,
            message_sent: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }

    return {
        success: true,
        consent_id: consent.id,
        message_sent: messageSent,
    };
}
