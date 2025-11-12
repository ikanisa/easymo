import type { RouterContext } from "../types.ts";
import { setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { sendListMessage } from "../utils/reply.ts";
import { t } from "../i18n/translator.ts";
import { logStructuredEvent } from "../observe/log.ts";

export const PROFILE_STATE_KEY = "profile_menu";

type ProfileMenuRow = {
  id: string;
  title: string;
  description: string;
};

/**
 * Display the Profile menu with options for managing businesses and tokens
 */
export async function sendProfileMenu(
  ctx: RouterContext,
): Promise<void> {
  if (!ctx.profileId) {
    console.warn("profile.no_profile_id", { from: ctx.from });
    return;
  }

  await logStructuredEvent("PROFILE_MENU_SHOWN", {
    profileId: ctx.profileId,
    from: ctx.from,
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: PROFILE_STATE_KEY,
    data: {},
  });

  const rows: ProfileMenuRow[] = [
    {
      id: IDS.PROFILE_MANAGE_BUSINESSES,
      title: t(ctx.locale, "profile.rows.manageBusinesses.title"),
      description: t(ctx.locale, "profile.rows.manageBusinesses.description"),
    },
    {
      id: IDS.WALLET,
      title: t(ctx.locale, "profile.rows.myTokens.title"),
      description: t(ctx.locale, "profile.rows.myTokens.description"),
    },
    {
      id: IDS.PROFILE_ADD_BUSINESS,
      title: t(ctx.locale, "profile.rows.addBusiness.title"),
      description: t(ctx.locale, "profile.rows.addBusiness.description"),
    },
    {
      id: IDS.BACK_HOME,
      title: t(ctx.locale, "home.extras.back.title"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "profile.menu.title"),
      body: t(ctx.locale, "profile.menu.body"),
      sectionTitle: t(ctx.locale, "profile.menu.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "👤" },
  );
}
