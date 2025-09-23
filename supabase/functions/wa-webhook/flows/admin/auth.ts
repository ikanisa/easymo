import type { RouterContext } from "../../types.ts";

type AdminCache = {
  numbers: Set<string>;
  loadedAt: number;
};

let cache: AdminCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizePhone(value: string): string {
  if (!value) return value;
  let s = value.trim();
  if (!s) return s;
  if (!s.startsWith("+")) {
    if (s.startsWith("250")) s = `+${s}`;
    else if (s.startsWith("0")) s = `+250${s.slice(1)}`;
    else s = `+${s}`;
  }
  return s;
}

async function loadAdminNumbers(ctx: RouterContext): Promise<Set<string>> {
  const now = Date.now();
  if (cache && (now - cache.loadedAt) < CACHE_TTL_MS) {
    return cache.numbers;
  }
  const { data, error } = await ctx.supabase
    .from("app_config")
    .select("admin_numbers, insurance_admin_numbers")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("admin.load_config_fail", error);
    cache = { numbers: new Set(), loadedAt: now };
    return cache.numbers;
  }
  const merged = [
    ...(data?.admin_numbers ?? []),
    ...(data?.insurance_admin_numbers ?? []),
  ].map((n: string) => normalizePhone(n)).filter(Boolean);
  cache = {
    numbers: new Set(merged),
    loadedAt: now,
  };
  return cache.numbers;
}

export async function isAdminNumber(ctx: RouterContext): Promise<boolean> {
  const admins = await loadAdminNumbers(ctx);
  const normalized = normalizePhone(ctx.from);
  return admins.has(normalized);
}
