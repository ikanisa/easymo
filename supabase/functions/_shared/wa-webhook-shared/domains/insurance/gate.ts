import type { RouterContext } from "../../types.ts";
import { detectCountryIso, normalizeE164 } from "../../utils/phone.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { isAdminNumber } from "../../flows/admin/auth.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { t } from "../../i18n/translator.ts";

const FEATURE_NAME = "motor_insurance";

// Global app config row ID (singleton pattern used by app_config table)
const APP_CONFIG_ID = 1;

// Default countries (fallback if not configured in app_config)
const DEFAULT_ALLOWED_COUNTRIES = new Set(["RW"]);

// Cache for allowed countries from app_config
type CountryCache = {
  countries: Set<string>;
  loadedAt: number;
};

let countryCache: CountryCache | null = null;
const COUNTRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get allowed countries for insurance feature.
 * Tries to load from app_config table, falls back to default if not configured.
 */
async function getAllowedCountries(ctx: RouterContext): Promise<Set<string>> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (countryCache && now - countryCache.loadedAt < COUNTRY_CACHE_TTL_MS) {
    return countryCache.countries;
  }

  try {
    const { data, error } = await ctx.supabase
      .from("app_config")
      .select("insurance_allowed_countries")
      .eq("id", APP_CONFIG_ID)
      .maybeSingle();
    
    if (error) {
      console.warn("motor_insurance.config_load_fail", { error: error.message });
      countryCache = { countries: DEFAULT_ALLOWED_COUNTRIES, loadedAt: now };
      return DEFAULT_ALLOWED_COUNTRIES;
    }
    
    const configuredCountries = data?.insurance_allowed_countries;
    if (Array.isArray(configuredCountries) && configuredCountries.length > 0) {
      const countries = new Set(
        configuredCountries
          .map((c: unknown) => typeof c === 'string' ? c.toUpperCase().trim() : '')
          .filter((c: string) => c.length === 2)
      );
      
      if (countries.size > 0) {
        countryCache = { countries, loadedAt: now };
        return countries;
      }
    }
    
    countryCache = { countries: DEFAULT_ALLOWED_COUNTRIES, loadedAt: now };
    return DEFAULT_ALLOWED_COUNTRIES;
  } catch (err) {
    console.error("motor_insurance.config_load_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    countryCache = { countries: DEFAULT_ALLOWED_COUNTRIES, loadedAt: now };
    return DEFAULT_ALLOWED_COUNTRIES;
  }
}

type GateRule =
  | "admin_override"
  | "country_allow"
  | "country_block"
  | "country_unknown";

export type MotorInsuranceGateResult = {
  allowed: boolean;
  isAdmin: boolean;
  detectedCountry: string | null;
  rule: GateRule;
};

export type MotorInsuranceGateContext = "menu" | "command";

export async function evaluateMotorInsuranceGate(
  ctx: RouterContext,
): Promise<MotorInsuranceGateResult> {
  const isAdmin = await isAdminNumber(ctx);
  const detectedCountry = detectCountryIso(ctx.from);
  if (isAdmin) {
    return {
      allowed: true,
      isAdmin: true,
      detectedCountry,
      rule: "admin_override",
    };
  }
  
  const allowedCountries = await getAllowedCountries(ctx);
  const upperCountry = detectedCountry?.toUpperCase() ?? null;
  if (upperCountry && allowedCountries.has(upperCountry)) {
    return {
      allowed: true,
      isAdmin: false,
      detectedCountry: upperCountry,
      rule: "country_allow",
    };
  }
  return {
    allowed: false,
    isAdmin: false,
    detectedCountry: upperCountry,
    rule: upperCountry ? "country_block" : "country_unknown",
  };
}

export async function recordMotorInsuranceHidden(
  ctx: RouterContext,
  gate: MotorInsuranceGateResult,
  source: MotorInsuranceGateContext,
): Promise<void> {
  if (gate.allowed) return;
  const normalized = normalizeE164(ctx.from) ?? ctx.from.trim();
  const ruleHit = `${gate.rule}:${source}`;
  const payload = {
    feature: FEATURE_NAME,
    rule_hit: ruleHit,
    msisdn: normalized,
    detected_country: gate.detectedCountry,
    user_id: ctx.profileId ?? null,
  };
  const { error } = await ctx.supabase.from("feature_gate_audit").insert(
    payload,
  );
  if (error) {
    console.error("motor_insurance.gate_audit_fail", error);
  }
  await logStructuredEvent("FEATURE_GATE_DECISION", {
    feature: FEATURE_NAME,
    allowed: gate.allowed,
    rule: gate.rule,
    source,
    detected_country: gate.detectedCountry,
    msisdn_suffix: normalized.slice(-6),
  });
}

export async function sendMotorInsuranceBlockedMessage(
  ctx: RouterContext,
): Promise<void> {
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "insurance.blocked"),
    homeOnly(),
    { emoji: "🚫" },
  );
}