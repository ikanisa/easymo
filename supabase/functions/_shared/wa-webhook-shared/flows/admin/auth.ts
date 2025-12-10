import type { RouterContext } from "../../types.ts";
import { getAdminAuthNumbers } from "../../../admin-contacts.ts";

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
  
  // Remove all non-digit characters
  const digits = s.replace(/[^0-9]/g, '');
  
  if (!s.startsWith("+")) {
    if (digits.startsWith("250") || digits.startsWith("356")) {
      return `+${digits}`;
    } else if (digits.startsWith("0") && digits.length === 10) {
      return `+250${digits.slice(1)}`;
    }
    return `+${digits}`;
  }
  return s;
}

/**
 * Load admin numbers from insurance_admin_contacts table (category: admin_auth)
 * This replaces the old hardcoded DEFAULT_ADMIN_NUMBERS array
 */
async function loadAdminNumbers(ctx: RouterContext): Promise<Set<string>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cache && (now - cache.loadedAt) < CACHE_TTL_MS) {
    return cache.numbers;
  }

  try {
    // Fetch from unified admin contacts table
    const numbers = await getAdminAuthNumbers(ctx.supabase);
    
    cache = {
      numbers,
      loadedAt: now,
    };
    
    return cache.numbers;
  } catch (error) {
    console.error("admin.load_numbers_fail", error);
    
    // Return empty set on error (no fallback to hardcoded numbers)
    // Admin numbers MUST be configured in database
    cache = { numbers: new Set(), loadedAt: now };
    return cache.numbers;
  }
}

export async function isAdminNumber(ctx: RouterContext): Promise<boolean> {
  const admins = await loadAdminNumbers(ctx);
  const normalized = normalizePhone(ctx.from);
  return admins.has(normalized);
}
