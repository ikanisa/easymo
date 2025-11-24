import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import {
  favoriteKindLabel,
  readLastLocation,
  saveFavorite,
  type FavoriteKind,
} from "./favorites.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";

export const LOCATION_KIND_BY_ID: Record<string, FavoriteKind> = {
  [IDS.LOCATION_SAVE_HOME]: "home",
  [IDS.LOCATION_SAVE_WORK]: "work",
  [IDS.LOCATION_SAVE_SCHOOL]: "school",
  [IDS.LOCATION_SAVE_OTHER]: "other",
};

export async function handleQuickSaveLocation(
  ctx: RouterContext,
  kind: FavoriteKind,
): Promise<boolean> {
  const coords = await readLastLocation(ctx);
  if (!coords) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.save_missing"),
      homeOnly(),
    );
    return true;
  }
  const saved = await saveFavorite(ctx, kind, coords, {
    label: favoriteKindLabel(kind),
  });
  if (!saved) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.save_error"),
      homeOnly(),
    );
    return true;
  }
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "location.saved.save_confirm", { label: saved.label }),
    homeOnly(),
  );
  return true;
}

export function buildSaveRows(
  ctx: RouterContext,
): Array<{ id: string; title: string; description?: string }> {
  return [
    {
      id: IDS.LOCATION_SAVE_HOME,
      title: t(ctx.locale, "location.saved.row.home"),
    },
    {
      id: IDS.LOCATION_SAVE_WORK,
      title: t(ctx.locale, "location.saved.row.work"),
    },
    {
      id: IDS.LOCATION_SAVE_SCHOOL,
      title: t(ctx.locale, "location.saved.row.school"),
    },
    {
      id: IDS.LOCATION_SAVE_OTHER,
      title: t(ctx.locale, "location.saved.row.other"),
    },
  ];
}
