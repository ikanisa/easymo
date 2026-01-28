/**
 * Consent Handler — Handle YES/NO Replies
 *
 * Parses inbound messages to detect consent responses
 * and updates the call_consents table accordingly.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    HandleConsentReplyInput,
    HandleConsentReplyOutput,
    CallConsentState,
    CallConsentRecord,
} from './types';

// =============================================================================
// Consent Reply Patterns
// =============================================================================

const AFFIRMATIVE_PATTERNS: Record<string, RegExp[]> = {
    en: [/^(yes|yeah|yep|ok|okay|sure|go ahead|yes please)$/i],
    fr: [/^(oui|d'accord|ok|okay|ouais|vas-y)$/i],
    rw: [/^(yego|ego|ni byiza)$/i],
};

const NEGATIVE_PATTERNS: Record<string, RegExp[]> = {
    en: [/^(no|nope|no thanks|don't call|not now)$/i],
    fr: [/^(non|pas maintenant|ne m'appelez pas)$/i],
    rw: [/^(oya|reka)$/i],
};

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle an inbound message that may be a consent reply.
 * Returns whether a consent was matched and updated.
 */
export async function handleConsentReply(
    supabase: SupabaseClient,
    input: HandleConsentReplyInput
): Promise<HandleConsentReplyOutput> {
    const { conversation_id, message_body } = input;
    const normalizedBody = message_body.trim();

    // Check for pending consent request
    const pendingConsent = await getPendingConsentRequest(supabase, conversation_id);
    if (!pendingConsent) {
        return { matched: false };
    }

    // Parse the reply
    const consentDecision = parseConsentReply(normalizedBody);
    if (!consentDecision) {
        return { matched: false };
    }

    // Update consent record
    const newState: CallConsentState = consentDecision === 'yes' ? 'granted' : 'denied';
    const now = new Date().toISOString();

    const updateData: Partial<CallConsentRecord> = {
        state: newState,
        [consentDecision === 'yes' ? 'granted_at' : 'denied_at']: now,
    };

    // If granted, set expiration (24 hours)
    if (newState === 'granted') {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        updateData.expires_at = expiresAt;
    }

    const { error } = await supabase
        .from('moltbot_call_consents')
        .update(updateData)
        .eq('id', pendingConsent.id);

    if (error) {
        console.error('[consentHandler] Failed to update consent:', error);
        return { matched: true, consent_id: pendingConsent.id, new_state: newState };
    }

    // Send confirmation message
    const confirmation = await sendConsentConfirmation(supabase, conversation_id, newState);

    return {
        matched: true,
        consent_id: pendingConsent.id,
        new_state: newState,
        confirmation_sent: confirmation,
    };
}

// =============================================================================
// Helpers
// =============================================================================

async function getPendingConsentRequest(
    supabase: SupabaseClient,
    conversationId: string
): Promise<CallConsentRecord | null> {
    const { data, error } = await supabase
        .from('moltbot_call_consents')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('state', 'requested')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[consentHandler] Error fetching pending consent:', error);
        return null;
    }

    return data as CallConsentRecord | null;
}

function parseConsentReply(message: string): 'yes' | 'no' | null {
    // Check all language patterns
    for (const patterns of Object.values(AFFIRMATIVE_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                return 'yes';
            }
        }
    }

    for (const patterns of Object.values(NEGATIVE_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                return 'no';
            }
        }
    }

    return null;
}

async function sendConsentConfirmation(
    supabase: SupabaseClient,
    conversationId: string,
    state: CallConsentState
): Promise<boolean> {
    // Get conversation language for localized response
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('language')
        .eq('id', conversationId)
        .single();

    const language = conversation?.language || 'en';

    const messages: Record<string, Record<CallConsentState, string>> = {
        en: {
            granted: "Thanks! I may place a call if needed to speed things up.",
            denied: "No problem. I'll continue via chat only.",
            not_requested: '',
            requested: '',
            expired: '',
        },
        fr: {
            granted: "Merci ! Je pourrai appeler si nécessaire pour accélérer les choses.",
            denied: "Pas de souci. Je continue uniquement par chat.",
            not_requested: '',
            requested: '',
            expired: '',
        },
        rw: {
            granted: "Murakoze! Nshobora guhamagara iyo bikenewe.",
            denied: "Nta kibazo. Nkomeza ubutumwa gusa.",
            not_requested: '',
            requested: '',
            expired: '',
        },
    };

    const message = messages[language]?.[state] || messages.en[state];
    if (!message) return false;

    // TODO: Wire to WhatsApp transport (Workflow 14)
    console.log(`[CONSENT] Sending confirmation to ${conversationId}: ${message}`);
    return true;
}

// =============================================================================
// Exports
// =============================================================================

export { parseConsentReply, AFFIRMATIVE_PATTERNS, NEGATIVE_PATTERNS };
