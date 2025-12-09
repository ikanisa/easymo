import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUserAndProfile } from "@/lib/auth";
import type { Database } from "@/lib/supabase/types";
import { supabaseSrv } from "@/lib/supabase/server";
import { logWarn, updateLogContext } from "@/lib/observability/logger";

export class AdminPermissionError extends Error {
  constructor(
    message: string,
    public readonly extras: Record<string, unknown> | undefined = undefined
  ) {
    super(message);
    this.name = "AdminPermissionError";
  }
}

export interface AdminGuardOptions<
  Client extends SupabaseClient<Database> = SupabaseClient<Database>,
> {
  action: string;
  reason: string;
  allowedRoles?: Array<Database["public"]["Enums"]["app_role"]>;
  metadata?: Record<string, unknown>;
  logEvent?: string;
  fallbackResult?: Record<string, unknown>;
  clientFactory?: () => Promise<Client> | Client;
}

export interface AdminContext<Client extends SupabaseClient<Database> = SupabaseClient<Database>> {
  supabase: Client;
  user: Awaited<ReturnType<typeof requireUserAndProfile>>["user"];
  profile: Awaited<ReturnType<typeof requireUserAndProfile>>["profile"];
}

const DEFAULT_ALLOWED_ROLES: Array<Database["public"]["Enums"]["app_role"]> = ["SYSTEM_ADMIN"];

export async function requireAdminContext<Client extends SupabaseClient<Database>>({
  action,
  reason,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  metadata = {},
  logEvent,
  fallbackResult,
  clientFactory,
}: AdminGuardOptions<Client>): Promise<AdminContext<Client>> {
  const { user, profile } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  if (!allowedRoles.includes(profile.role)) {
    const event = logEvent ?? `${action}_denied`;
    logWarn(event, { ...metadata, actorRole: profile.role });
    throw new AdminPermissionError(reason, fallbackResult);
  }

  const supabase = (await (clientFactory ? clientFactory() : supabaseSrv())) as Client;

  return { supabase, user, profile };
}

type GuardDenied<Result> = { denied: true; result: Result };
type GuardGranted<Client extends SupabaseClient<Database>> = {
  denied: false;
  context: AdminContext<Client>;
};

export async function guardAdminAction<
  Result,
  Client extends SupabaseClient<Database> = SupabaseClient<Database>,
>(
  options: AdminGuardOptions<Client>,
  onDenied: (error: AdminPermissionError) => Result
): Promise<GuardDenied<Result> | GuardGranted<Client>> {
  try {
    const context = await requireAdminContext<Client>(options);
    return { denied: false, context };
  } catch (error) {
    if (error instanceof AdminPermissionError) {
      return { denied: true, result: onDenied(error) };
    }
    throw error;
  }
}
