import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { t } from "../../i18n/translator.ts";
import { homeOnly, sendButtonsMessage } from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { maskPhone } from "../../flows/support.ts";
import { emitAlert } from "../../observe/alert.ts";
import { waChatLink } from "../../utils/links.ts";
import type { ScheduleState } from "./booking.ts";
import {
  createTripAndDeliverMatches,
  deliverMatches,
  fetchMatches,
  kmToMeters,
  matchActionButtons,
  shareDropoffButtons,
} from "./booking.ts";

export async function handleScheduleRefresh(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (
    !ctx.profileId || !state.tripId || !state.role || !state.vehicle ||
    !state.origin
  ) {
    return false;
  }
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;

  try {
    const matches = await fetchMatches(ctx, state, {
      preferDropoff: Boolean(state.dropoff),
      limit: max,
      radiusMeters,
    });

    await deliverMatches(ctx, state, matches, {
      messagePrefix: t(ctx.locale, "schedule.matches.refresh"),
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_refresh_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage: "refresh",
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage: "refresh",
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "schedule.errors.match_refresh"),
      matchActionButtons(state),
    );
    return true;
  }
}

export async function requestScheduleDropoff(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) {
    return false;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "mobility_schedule_dropoff",
    data: { ...state },
  });
  try {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "schedule.dropoff.instructions", {
        instructions: t(ctx.locale, "location.share.instructions"),
      }),
      shareDropoffButtons(ctx),
    );
  } catch (e) {
    const fallbackBody = t(ctx.locale, "schedule.dropoff.instructions", {
      instructions: t(ctx.locale, "location.share.instructions"),
    });
    try {
      await sendText(ctx.from, fallbackBody);
    } catch (_) {
      // noop
    }
  }
  return true;
}

export async function handleScheduleResultSelection(
  ctx: RouterContext,
  state: ScheduleState,
  id: string,
): Promise<boolean> {
  if (!state.rows || !ctx.profileId) return false;
  const match = state.rows.find((row) => row.id === id);
  if (!match) return false;
  await logStructuredEvent("MATCH_SELECTION", {
    flow: "schedule",
    role: state.role,
    trip_id: state.tripId ?? null,
    selected_trip_id: match.tripId,
  });
  const link = waChatLink(match.whatsapp, `Hi, I'm Ref ${match.ref}`);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "schedule.chat.cta", { link }),
    [
      {
        id: IDS.SCHEDULE_REFRESH_RESULTS,
        title: t(ctx.locale, "common.buttons.refresh"),
      },
      ...homeOnly(),
    ],
  );
  return true;
}

export async function handleScheduleRecent(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const { data } = await ctx.supabase
      .from("profiles")
      .select("metadata")
      .eq("user_id", ctx.profileId)
      .maybeSingle();
    const root = (data?.metadata && typeof data.metadata === "object")
      ? (data!.metadata as Record<string, unknown>)
      : {};
    const last = (root as any)?.mobility?.schedule?.last;
    if (!last || !last.role || !last.vehicle || !last.origin) {
      await sendButtonsMessage(
        ctx,
        "No recent schedule found.",
        [{ id: IDS.SCHEDULE_TRIP, title: "New schedule" }],
      );
      return true;
    }
    const state: ScheduleState = {
      role: last.role,
      vehicle: last.vehicle,
      origin: last.origin,
      dropoff: last.dropoff ?? null,
      travelLabel: last.travelLabel ?? null,
    };
    return await createTripAndDeliverMatches(ctx, state, {
      dropoff: state.dropoff ?? null,
      travelLabel: state.travelLabel ?? null,
    });
  } catch (_) {
    await sendButtonsMessage(
      ctx,
      "Could not load your recent schedule.",
      [{ id: IDS.SCHEDULE_TRIP, title: "New schedule" }],
    );
    return true;
  }
}
