import type { SupabaseClient } from "../../_shared/supabase.ts";
import { logStructuredEvent } from "../observe/log.ts";

export interface ApprovedTemplate {
  intent: string;
  templateKey: string;
  templateName: string;
  locale: string;
  metaTemplateId?: string | null;
  bodyVariables: string[];
  retryPolicy?: {
    maxAttempts?: number;
    backoffMs?: number;
  };
  metadata?: Record<string, unknown> | null;
}

function parseBodyVariables(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const container = raw as Record<string, unknown>;
  const body = container.body;
  if (!Array.isArray(body)) return [];
  return body.map((entry, index) => {
    if (typeof entry === "string" && entry.trim()) {
      return entry.trim();
    }
    if (entry && typeof entry === "object" && "name" in entry) {
      const named = (entry as Record<string, unknown>).name;
      if (typeof named === "string" && named.trim()) {
        return named.trim();
      }
    }
    return `var_${index + 1}`;
  });
}

function parseRetryPolicy(raw: unknown): ApprovedTemplate["retryPolicy"] {
  if (!raw || typeof raw !== "object") return undefined;
  const { max_attempts, maxAttempts, backoff_ms, backoffMs } = raw as Record<string, unknown>;
  const result: ApprovedTemplate["retryPolicy"] = {};
  if (typeof max_attempts === "number") result.maxAttempts = max_attempts;
  else if (typeof maxAttempts === "number") result.maxAttempts = maxAttempts;
  if (typeof backoff_ms === "number") result.backoffMs = backoff_ms;
  else if (typeof backoffMs === "number") result.backoffMs = backoffMs;
  return Object.keys(result).length ? result : undefined;
}

const registrySingleton = new (class TemplateRegistry {
  private cache = new Map<string, ApprovedTemplate | null>();
  private inflight = new Map<string, Promise<ApprovedTemplate | null>>();

  private cacheKey(intent: string, locale?: string | null): string {
    return `${intent.toLowerCase()}::${(locale ?? "*").toLowerCase()}`;
  }

  async get(
    supabase: SupabaseClient,
    intent: string,
    locale?: string | null,
  ): Promise<ApprovedTemplate | null> {
    if (!intent) return null;
    const key = this.cacheKey(intent, locale);
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }
    let promise = this.inflight.get(key);
    if (!promise) {
      promise = this.fetchTemplate(supabase, intent, locale);
      this.inflight.set(key, promise);
    }
    const result = await promise;
    this.cache.set(key, result ?? null);
    this.inflight.delete(key);
    return result ?? null;
  }

  private async fetchTemplate(
    supabase: SupabaseClient,
    intent: string,
    locale?: string | null,
  ): Promise<ApprovedTemplate | null> {
    const normalizedIntent = intent.toLowerCase();
    const filters = supabase
      .from("whatsapp_templates")
      .select(
        "id, template_key, template_name, locale, meta_template_id, metadata, variables, retry_policy, approval_status",
      )
      .eq("is_active", true)
      .contains("metadata", { intent: normalizedIntent })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (locale) {
      filters.eq("locale", locale);
    }

    // Approval status can be null for legacy rows; treat null as not approved
    const approvalFilter = filters.or("approval_status.eq.approved,approval_status.eq.APPROVED");
    const { data, error } = await approvalFilter.maybeSingle();
    if (error) {
      await logStructuredEvent("AI_TEMPLATE_LOOKUP_ERROR", {
        intent: normalizedIntent,
        locale: locale ?? null,
        error: error.message,
      });
      return null;
    }

    if (!data && locale) {
      // try fallback locale
      return await this.fetchTemplate(supabase, intent, null);
    }

    if (!data) {
      await logStructuredEvent("AI_TEMPLATE_NOT_FOUND", {
        intent: normalizedIntent,
        locale: locale ?? null,
      });
      return null;
    }

    const approved: ApprovedTemplate = {
      intent: normalizedIntent,
      templateKey: data.template_key,
      templateName: data.template_name,
      locale: data.locale ?? locale ?? "en",
      metaTemplateId: data.meta_template_id ?? null,
      bodyVariables: parseBodyVariables(data.variables ?? undefined),
      retryPolicy: parseRetryPolicy(data.retry_policy ?? undefined),
      metadata: (data.metadata ?? null) as Record<string, unknown> | null,
    };

    await logStructuredEvent("AI_TEMPLATE_APPROVED", {
      intent: normalizedIntent,
      locale: approved.locale,
      template_key: approved.templateKey,
      meta_template_id: approved.metaTemplateId,
      body_variables: approved.bodyVariables,
    });

    return approved;
  }
})();

export function getTemplateRegistry() {
  return registrySingleton;
}
