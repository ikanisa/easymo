import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/observability/logger";

let createClient = createSupabaseServerClient;
let emitError = logError;

/**
 * Overrides the Supabase client factory used by {@link logAudit}. Primarily for tests.
 */
export function configureAuditClientFactory(factory?: typeof createSupabaseServerClient) {
  createClient = factory ?? createSupabaseServerClient;
}

/**
 * Overrides the logger used when audit writes fail. Primarily for tests.
 */
export function configureAuditErrorLogger(loggerFn?: typeof logError) {
  emitError = loggerFn ?? logError;
}

type AuditPayload = {
  action: string;
  entity: string;
  entityId: string;
  diff?: Record<string, unknown> | null;
};

const AUDIT_FALLBACK_ACTOR = "00000000-0000-0000-0000-000000000000";

export const logAudit = async ({ action, entity, entityId, diff }: AuditPayload) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await (supabase as any).from("app.audit_logs").insert({
    action,
    entity,
    entity_id: entityId,
    diff: diff ?? null,
    actor: user?.id ?? AUDIT_FALLBACK_ACTOR,
  });

  if (error) {
    emitError("audit_log_write_failed", { action, entity, entityId, error });
  }
};
