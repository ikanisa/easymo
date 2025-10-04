import type { RouterContext } from "../../types.ts";
import { detectCountryIso, normalizeE164 } from "../../utils/phone.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { isAdminNumber } from "../../flows/admin/auth.ts";
import { logStructuredEvent } from "../../observe/log.ts";

const FEATURE_NAME = "motor_insurance";
const ALLOWED_COUNTRIES = new Set(["RW"]);

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
  const upperCountry = detectedCountry?.toUpperCase() ?? null;
  if (upperCountry && ALLOWED_COUNTRIES.has(upperCountry)) {
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
    "This feature isn’t available in your country.",
    homeOnly(),
    { emoji: "🚫" },
  );
}
