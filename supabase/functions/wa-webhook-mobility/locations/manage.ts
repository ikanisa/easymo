import type { RouterContext } from "../types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { t } from "../i18n/translator.ts";
import {
  type FavoriteKind,
  favoriteKindLabel,
  getFavoriteById,
  listFavorites,
  saveFavorite,
  updateFavorite,
  type UserFavorite,
} from "./favorites.ts";
import { buildSaveRows, LOCATION_KIND_BY_ID } from "./save.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../wa/ids.ts";

const FAVORITE_ROW_PREFIX = "FAVM::";
export const SAVED_PLACES_ADD_ID = "saved_places_add";
export const SAVED_PLACES_SKIP_ID = "saved_places_skip";

export type SavedPlaceCaptureState = {
  mode: "create" | "edit";
  kind: FavoriteKind;
  label: string;
  favoriteId?: string;
};

export async function startSavedPlaces(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "saved_places_list",
    data: {},
  });
  const favorites = await listFavorites(ctx);
  if (!favorites.length) {
    const instructions = t(ctx.locale, "location.share.instructions");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.manage.empty_cta", { instructions }),
      buildButtons(
        {
          id: SAVED_PLACES_ADD_ID,
          title: t(ctx.locale, "location.saved.manage.add_row"),
        },
        {
          id: SAVED_PLACES_SKIP_ID,
          title: t(ctx.locale, "location.saved.manage.button.skip"),
        },
      ),
      { emoji: "⭐" },
    );
    return true;
  }
  const rows = [
    ...favorites.map((favorite) => buildFavoriteRow(ctx, favorite)),
    buildAddRow(ctx),
    buildBackRow(ctx),
  ];
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.manage.title"),
      body: favorites.length
        ? t(ctx.locale, "location.saved.manage.body")
        : t(ctx.locale, "location.saved.manage.empty"),
      sectionTitle: t(ctx.locale, "location.saved.manage.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "⭐" },
  );
  return true;
}

export async function handleSavedPlacesListSelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (id === SAVED_PLACES_ADD_ID) {
    return await startSavedPlaceCreation(ctx);
  }
  if (id === IDS.BACK_MENU) return false;
  const favoriteId = parseFavoriteRowId(id);
  if (!favoriteId) return false;
  return await promptFavoriteUpdate(ctx, favoriteId);
}

export async function handleSavedPlacesAddSelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const kind = LOCATION_KIND_BY_ID[id];
  if (!kind) return false;
  const favorites = await listFavorites(ctx);
  const existing = favorites.find((fav) => fav.kind === kind);
  return await startFavoriteCapture(ctx, { kind, favorite: existing });
}

export async function handleSavedPlaceLocation(
  ctx: RouterContext,
  state: SavedPlaceCaptureState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (!state?.kind || !state?.mode) return false;
  const label = state.label || favoriteKindLabel(state.kind);

  const success = state.mode === "edit" && state.favoriteId
    ? await updateFavorite(ctx, state.favoriteId, coords, { label })
    : Boolean(await saveFavorite(ctx, state.kind, coords, { label }));

  if (!success) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.save_error"),
      buildButtons({
        id: IDS.SAVED_PLACES,
        title: t(ctx.locale, "location.saved.manage.button.back"),
      }),
    );
    return true;
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "location.saved.save_confirm", { label }),
    buildButtons({
      id: IDS.SAVED_PLACES,
      title: t(ctx.locale, "location.saved.manage.button.back"),
    }),
  );
  await startSavedPlaces(ctx);
  return true;
}

async function startAddFavoriteFlow(ctx: RouterContext): Promise<boolean> {
  return await startSavedPlaceCreation(ctx);
}

export async function startSavedPlaceCreation(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "saved_places_add",
    data: {},
  });
  const rows = [
    ...buildSaveRows(ctx),
    buildBackRow(ctx),
  ];
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.add_list.title"),
      body: t(ctx.locale, "location.saved.add_list.body"),
      sectionTitle: t(ctx.locale, "location.saved.add_list.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "➕" },
  );
  return true;
}

async function promptFavoriteUpdate(
  ctx: RouterContext,
  favoriteId: string,
): Promise<boolean> {
  const favorite = await getFavoriteById(ctx, favoriteId);
  if (!favorite) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.list.expired"),
      buildButtons({
        id: IDS.SAVED_PLACES,
        title: t(ctx.locale, "location.saved.manage.button.back"),
      }),
    );
    return true;
  }
  return await startFavoriteCapture(ctx, {
    kind: favorite.kind,
    favorite,
    mode: "edit",
  });
}

async function startFavoriteCapture(
  ctx: RouterContext,
  options: {
    kind: FavoriteKind;
    favorite?: UserFavorite;
    mode?: "create" | "edit";
  },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const label = options.favorite?.label ?? favoriteKindLabel(options.kind);
  const mode = options.mode ?? (options.favorite ? "edit" : "create");

  await setState(ctx.supabase, ctx.profileId, {
    key: "saved_place_capture",
    data: {
      mode,
      kind: options.kind,
      label,
      favoriteId: options.favorite?.id,
    } satisfies SavedPlaceCaptureState,
  });

  const copyKey = mode === "edit"
    ? "location.saved.capture.update"
    : "location.saved.capture.new";

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, copyKey, { label }),
    buildButtons({
      id: IDS.SAVED_PLACES,
      title: t(ctx.locale, "location.saved.manage.button.back"),
    }),
  );
  return true;
}

function buildFavoriteRow(
  ctx: RouterContext,
  favorite: UserFavorite,
): { id: string; title: string; description?: string } {
  const icon = iconForKind(favorite.kind);
  const coordsLabel = t(ctx.locale, "location.saved.manage.coords", {
    lat: favorite.lat.toFixed(4),
    lng: favorite.lng.toFixed(4),
  });
  return {
    id: `${FAVORITE_ROW_PREFIX}${favorite.id}`,
    title: `${icon} ${favorite.label}`,
    description: favorite.address?.trim()?.length
      ? favorite.address
      : coordsLabel,
  };
}

function buildAddRow(ctx: RouterContext) {
  return {
    id: SAVED_PLACES_ADD_ID,
    title: t(ctx.locale, "location.saved.manage.add_row"),
    description: t(ctx.locale, "location.saved.manage.add_desc"),
  };
}

function buildBackRow(ctx: RouterContext) {
  return {
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  };
}

function parseFavoriteRowId(id: string): string | null {
  if (!id.startsWith(FAVORITE_ROW_PREFIX)) return null;
  return id.slice(FAVORITE_ROW_PREFIX.length);
}

function iconForKind(kind: FavoriteKind): string {
  switch (kind) {
    case "home":
      return "🏠";
    case "work":
      return "🏢";
    case "school":
      return "🏫";
    default:
      return "📍";
  }
}
