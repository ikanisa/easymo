/**
 * Audit Logger — Record all Moltbot decisions and tool calls
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEvent {
    request_id?: string;
    event_type: string;
    details?: Record<string, unknown>;
}

/**
 * Log an audit event to the database.
 * All Moltbot decisions and tool calls should be logged here.
 */
export async function logAuditEvent(
    supabase: SupabaseClient,
    event: AuditEvent
): Promise<void> {
    try {
        // For now, log to console. Will be persisted once audit table is created.
        console.log(`[AUDIT] ${event.event_type}`, {
            request_id: event.request_id,
            ...event.details,
            timestamp: new Date().toISOString(),
        });

        // TODO: Persist to moltbot_audit_events table (Phase 5)
        // await supabase.from('moltbot_audit_events').insert({
        //   request_id: event.request_id,
        //   event_type: event.event_type,
        //   details: event.details,
        //   created_at: new Date().toISOString(),
        // });
    } catch (error) {
        // Never throw from audit — log and continue
        console.error('[AUDIT ERROR]', error);
    }
}
