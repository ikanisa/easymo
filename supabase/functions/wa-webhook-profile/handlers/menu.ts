import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const PROFILE_STATE_HOME = "profile_home";

/**
 * Hard-coded Profile Menu Items
 * Simple, fast, no database queries required
 * Rwanda-only for now (as per requirements)
 */
const PROFILE_MENU_ITEMS = [
  {
    id: "EDIT_PROFILE",
    icon: "✏️",
    title: "Edit Profile",
    description: "Update name & language",
  },
  {
    id: IDS.WALLET,
    icon: "💎",
    title: "Wallet & Tokens",
    description: "Balance, transfers, earn",
  },
  {
    id: IDS.MOMO_QR,
    icon: "📱",
    title: "MoMo QR Code",
    description: "Your payment QR code",
  },
  {
    id: "SAVED_LOCATIONS",
    icon: "📍",
    title: "Saved Places",
    description: "Home, work, favorites",
  },
  {
    id: IDS.BACK_MENU,
    icon: "←",
    title: "Back to Menu",
    description: "",
  },
];

/**
 * Display the profile menu
 * Simple, instant response - no database queries for menu items
 */
export async function startProfile(
  ctx: RouterContext,
  _state?: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: PROFILE_STATE_HOME,
    data: {},
  });

  // Log menu display for analytics
  await logStructuredEvent("PROFILE_MENU_DISPLAYED", {
    userId: ctx.profileId,
    itemCount: PROFILE_MENU_ITEMS.length,
    locale: ctx.locale,
  });

  // Convert to list message format
  const rows = PROFILE_MENU_ITEMS.map((item) => ({
    id: item.id,
    title: `${item.icon} ${item.title}`,
    description: item.description,
  }));

  await sendListMessage(
    ctx,
    {
      title: "👤 Profile",
      body: "Manage your account, wallet, and favorite locations.",
      sectionTitle: "Profile",
      buttonText: "View",
      rows,
    },
    { emoji: "👤" },
  );

  return true;
}
