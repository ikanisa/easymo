import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { isAdminNumber } from "./auth.ts";

export const ADMIN_STATE = {
  ENTRY: "admin_entry",
  HUB_LIST: "admin_hub_list",
} as const;

type AdminStateKey = typeof ADMIN_STATE[keyof typeof ADMIN_STATE];

type AdminStateData = Record<string, unknown> | undefined;

type AdminStateOptions = {
  back?: AdminStateKey | null;
  data?: AdminStateData;
};

export async function ensureAdmin(
  ctx: RouterContext,
  options: { silent?: boolean } = {},
): Promise<boolean> {
  const authorized = await isAdminNumber(ctx);
  if (!authorized && !options.silent) {
    await sendText(
      ctx.from,
      "Admin tools are restricted. Message support if you need access.",
    );
  }
  return authorized;
}

export async function setAdminState(
  ctx: RouterContext,
  key: AdminStateKey,
  options: AdminStateOptions = {},
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, {
    key,
    data: {
      ...(options.data ?? {}),
      back: options.back ?? null,
    },
  });
}

export function nextAdminBack(
  state: { data?: Record<string, unknown> } | undefined,
): AdminStateKey | null {
  const raw = state?.data?.back;
  return typeof raw === "string" ? raw as AdminStateKey : null;
}
