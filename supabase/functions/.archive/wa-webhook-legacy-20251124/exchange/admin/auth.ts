import { supabase } from "../../config.ts";
import { normalizeWaId as normalizeWaIdInternal } from "../../utils/locale.ts";

export { normalizeWaId } from "../../utils/locale.ts";

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const PIN_SESSION_MINUTES = 30;

type AdminConfig = {
  admin_numbers: string[];
  insurance_admin_numbers: string[];
  admin_pin_required: boolean;
  admin_pin_hash: string | null;
};

type AdminConfigCache = {
  loadedAt: number;
  value: AdminConfig;
};

let cache: AdminConfigCache | null = null;

export class AdminForbiddenError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AdminForbiddenError";
  }
}

export class AdminPinRequiredError extends Error {
  constructor(message = "PIN required") {
    super(message);
    this.name = "AdminPinRequiredError";
  }
}

async function getAdminConfig(): Promise<AdminConfig> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < ADMIN_CACHE_TTL_MS) {
    return cache.value;
  }
  const { data, error } = await supabase
    .from("app_config")
    .select(
      "admin_numbers, insurance_admin_numbers, admin_pin_required, admin_pin_hash",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const value: AdminConfig = {
    admin_numbers: data?.admin_numbers ?? [],
    insurance_admin_numbers: data?.insurance_admin_numbers ?? [],
    admin_pin_required: Boolean(data?.admin_pin_required),
    admin_pin_hash: data?.admin_pin_hash ?? null,
  };
  cache = { loadedAt: now, value };
  return value;
}

export async function requireAdmin(
  waId: string,
): Promise<
  { normalized: string; config: AdminConfig; isInsuranceAdmin: boolean }
> {
  const config = await getAdminConfig();
  const normalized = normalizeWaIdInternal(waId);
  const inAdmins = config.admin_numbers.some((value) =>
    normalizeWaIdInternal(value) === normalized
  );
  const inInsurance = config.insurance_admin_numbers.some((value) =>
    normalizeWaIdInternal(value) === normalized
  );
  if (!inAdmins && !inInsurance) {
    throw new AdminForbiddenError();
  }
  return { normalized, config, isInsuranceAdmin: inInsurance };
}

export async function ensurePinSession(
  waId: string,
  config: AdminConfig,
): Promise<void> {
  if (!config.admin_pin_required) return;
  const normalized = normalizeWaIdInternal(waId);
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("pin_ok_until")
    .eq("wa_id", normalized)
    .maybeSingle();
  if (error) throw error;
  const expiresAt = data?.pin_ok_until ? new Date(data.pin_ok_until) : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    throw new AdminPinRequiredError();
  }
}

export async function markPinSession(waId: string): Promise<void> {
  const normalized = normalizeWaIdInternal(waId);
  const expiry = new Date(Date.now() + PIN_SESSION_MINUTES * 60 * 1000)
    .toISOString();
  const { error } = await supabase
    .from("admin_sessions")
    .upsert({ wa_id: normalized, pin_ok_until: expiry }, {
      onConflict: "wa_id",
    });
  if (error) throw error;
}
