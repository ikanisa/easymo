import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ProfileRow } from "@/lib/auth";

export interface TenantScope {
  saccoId: string | null;
  includeAll: boolean;
}

export type TenantSearchParams = Record<string, string | string[] | undefined>;
export type TenantScopeSearchParams =
  | TenantSearchParams
  | URLSearchParams
  | ReadonlyURLSearchParams;

export type TenantScopeSearchParamsInput =
  | TenantScopeSearchParams
  | Promise<TenantScopeSearchParams | undefined>
  | undefined;

export function resolveTenantScope(
  profile: ProfileRow,
  searchParams?: TenantSearchParams
): TenantScope {
  const raw = valueFromRecord(searchParams?.sacco);
  const requested = raw && raw.length > 0 ? raw : null;

  if (profile.role === "SYSTEM_ADMIN") {
    if (!requested || requested === "") {
      return { saccoId: null, includeAll: true };
    }
    return { saccoId: requested, includeAll: false };
  }

  if (requested && requested === profile.sacco_id) {
    return { saccoId: profile.sacco_id ?? null, includeAll: false };
  }

  return { saccoId: profile.sacco_id ?? null, includeAll: false };
}

function valueFromRecord(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : null;
  }
  return null;
}

export function normalizeTenantSearchParams(
  searchParams?: TenantScopeSearchParams
): TenantSearchParams | undefined {
  if (!searchParams) {
    return undefined;
  }

  if (isSearchParamsObject(searchParams)) {
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = value;
        continue;
      }
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    }
    return result as TenantSearchParams;
  }

  return searchParams as TenantSearchParams;
}

export async function resolveTenantScopeSearchParams(
  input: TenantScopeSearchParamsInput
): Promise<TenantSearchParams | undefined> {
  if (!input) {
    return undefined;
  }

  if (isPromiseLike(input)) {
    const awaited = await input;
    if (!awaited) {
      return undefined;
    }
    return normalizeTenantSearchParams(awaited);
  }

  return normalizeTenantSearchParams(input);
}

function isSearchParamsObject(value: unknown): value is URLSearchParams | ReadonlyURLSearchParams {
  if (!value || typeof value !== "object") return false;
  return (
    typeof (value as URLSearchParams).get === "function" &&
    typeof (value as URLSearchParams).entries === "function"
  );
}

function isPromiseLike(
  value: TenantScopeSearchParamsInput
): value is Promise<TenantScopeSearchParams | undefined> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === "function"
  );
}
