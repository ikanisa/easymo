import { z } from "zod";
import { logWarn, logError } from "@/lib/observability/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDefaultUssdOperator,
  getUssdOperatorById,
  ussdConfig,
  type UssdOperatorConfig,
} from "@ibimina/config";
import type { Database, Json } from "@/lib/supabase/types";

const TemplateRowSchema = z.object({
  operator_id: z.string(),
  version: z.string(),
  ttl_seconds: z.number().int().positive(),
  payload: z.object({}).passthrough(),
});

export interface CachedTemplate {
  operator: UssdOperatorConfig;
  version: string;
  ttlSeconds: number;
  expiresAt: number;
}

const templateCache = new Map<string, CachedTemplate>();

function coercePayload(payload: Json): UssdOperatorConfig {
  const operator = payload as unknown;
  const id = (operator as Record<string, unknown>)?.["id"];
  if (typeof id !== "string") {
    throw new Error("Invalid USSD operator payload: missing id");
  }

  const parsed = z.object({}).passthrough().parse(operator) as UssdOperatorConfig;

  return parsed;
}

function getFallback(operatorId?: string): CachedTemplate {
  const operator = operatorId
    ? (getUssdOperatorById(operatorId) ?? getDefaultUssdOperator())
    : getDefaultUssdOperator();

  const ttlSeconds = ussdConfig.ttlSeconds;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  return {
    operator,
    version: `config-${ussdConfig.version}`,
    ttlSeconds,
    expiresAt,
  };
}

export async function loadUssdTemplate(
  client: SupabaseClient<Database>,
  operatorId?: string
): Promise<CachedTemplate> {
  const targetOperator = operatorId ?? getDefaultUssdOperator().id;
  const cacheKey = targetOperator;
  const cached = templateCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const { data, error } = await client
    .schema("config")
    .from("ussd_templates")
    .select("operator_id, payload, version, ttl_seconds")
    .eq("operator_id", targetOperator)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    logError("Failed to load USSD template", error);
    const fallback = getFallback(operatorId);
    templateCache.set(cacheKey, fallback);
    return fallback;
  }

  if (!data) {
    const fallback = getFallback(operatorId);
    templateCache.set(cacheKey, fallback);
    return fallback;
  }

  const parsedRow = TemplateRowSchema.parse(data);
  const operator = coercePayload(parsedRow.payload);

  if (operator.id !== parsedRow.operator_id) {
    logWarn("USSD template payload id mismatch", parsedRow.operator_id, operator.id);
  }

  const ttlSeconds = parsedRow.ttl_seconds;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const cachedTemplate: CachedTemplate = {
    operator,
    version: parsedRow.version,
    ttlSeconds,
    expiresAt,
  };

  templateCache.set(cacheKey, cachedTemplate);
  return cachedTemplate;
}

export function clearUssdTemplateCache() {
  templateCache.clear();
}
