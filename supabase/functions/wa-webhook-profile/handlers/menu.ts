import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { fetchProfileMenuItems } from "../../_shared/wa-webhook-shared/utils/dynamic_submenu.ts";

export const PROFILE_STATE_HOME = "PROFILE_MENU";

/**
 * Display the profile menu with exactly 3 items from database
 * Items: MoMo QR Code, Wallet (Transfer Tokens), Share easyMO
 */
export async function startProfile(
  ctx: RouterContext,
  _state?: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    await setState(ctx.supabase, ctx.profileId, {
      key: PROFILE_STATE_HOME,
      data: {},
    });
  } catch (error) {
    // Log but continue - state setting failure shouldn't block menu display
    await logStructuredEvent("PROFILE_STATE_SET_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
  }

  // Fetch profile menu items from database (Rwanda-only, no country filtering)
  let menuItems: Array<{
    key: string;
    name: string;
    icon?: string | null;
    display_order: number;
    action_type: string;
    action_target: string | null;
    description: string | null;
  }> = [];
  
  try {
    menuItems = await fetchProfileMenuItems(ctx.supabase);
  } catch (error) {
    // Log error but continue with fallback menu
    await logStructuredEvent("PROFILE_MENU_FETCH_EXCEPTION", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
  }

  // Fallback to hardcoded items if database fetch fails
  const rows = menuItems.length > 0
    ? menuItems.map((item) => ({
        id: item.action_target || item.key,
        title: `${item.icon || ""} ${item.name || item.key}`.trim(),
        description: item.description || "",
      }))
    : [
        {
          id: IDS.MOMO_QR,
          title: "📱 MoMo QR Code",
          description: "Generate payment QR code",
        },
        {
          id: "WALLET",
          title: "💰 Wallet (Transfer Tokens)",
          description: "Send tokens to other users",
        },
        {
          id: IDS.SHARE_EASYMO,
          title: "🔗 Share easyMO",
          description: "Get your referral link",
        },
      ];

  await logStructuredEvent("PROFILE_MENU_DISPLAYED", {
    userId: ctx.profileId,
    itemCount: rows.length,
    source: menuItems.length > 0 ? "database" : "fallback",
  });

  try {
    await sendListMessage(
      ctx,
      {
        title: "👤 Profile",
        body: "Choose an option:",
        sectionTitle: "Options",
        buttonText: "Select",
        rows,
      },
    );
    return true;
  } catch (error) {
    await logStructuredEvent("PROFILE_MENU_SEND_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}
