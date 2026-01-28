/**
 * Feature Flags — Check if features are enabled
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Default flag values (fail-safe: AI features OFF by default)
const DEFAULT_FLAGS: Record<string, boolean> = {
    AI_CONCIERGE_ENABLED: false,
    OCR_ENABLED: false,
    CALLING_ENABLED: false,
};

/**
 * Check if a feature flag is enabled.
 * Falls back to safe defaults if flag is not found.
 */
export async function checkFeatureFlag(
    supabase: SupabaseClient,
    flagName: string
): Promise<boolean> {
    try {
        // Try to read from feature_flags table
        const { data, error } = await supabase
            .from('feature_flags')
            .select('enabled')
            .eq('name', flagName)
            .single();

        if (error || !data) {
            // Fall back to default
            return DEFAULT_FLAGS[flagName] ?? false;
        }

        return data.enabled;
    } catch {
        // On any error, return safe default
        return DEFAULT_FLAGS[flagName] ?? false;
    }
}

/**
 * Get all feature flags for Moltbot.
 */
export async function getMoltbotFlags(supabase: SupabaseClient): Promise<{
    ai_enabled: boolean;
    ocr_enabled: boolean;
    calling_enabled: boolean;
}> {
    const [ai, ocr, calling] = await Promise.all([
        checkFeatureFlag(supabase, 'AI_CONCIERGE_ENABLED'),
        checkFeatureFlag(supabase, 'OCR_ENABLED'),
        checkFeatureFlag(supabase, 'CALLING_ENABLED'),
    ]);

    return {
        ai_enabled: ai,
        ocr_enabled: ocr,
        calling_enabled: calling,
    };
}
