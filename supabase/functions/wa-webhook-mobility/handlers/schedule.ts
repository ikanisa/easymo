import type { ButtonSpec, RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { VEHICLE_OPTIONS, vehicleFromId } from "./nearby.ts";
import { t } from "../../i18n/translator.ts";
import {
  gateProFeature,
  insertTrip,
  matchDriversForTrip,
  matchPassengersForTrip,
  type MatchResult,
  updateTripDropoff,
} from "../../rpc/mobility.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { waChatLink } from "../../utils/links.ts";
import { maskPhone } from "../../flows/support.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { timeAgo } from "../../utils/text.ts";
import { sendText } from "../../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
  sendListWithActions,
} from "../../utils/reply.ts";
import { emitAlert } from "../../observe/alert.ts";
import {
  ensureVehiclePlate,
  getStoredVehicleType,
  updateStoredVehicleType,
} from "./vehicle_plate.ts";
import {
  getFavoriteById,
  listFavorites,
  saveFavorite,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";

const DEFAULT_WINDOW_DAYS = 30;
const REQUIRED_RADIUS_METERS = 10_000;
const DEFAULT_TIMEZONE = "Africa/Kigali";
const DAY_MS = 24 * 60 * 60 * 1000;

type TimeChoiceDef = {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  type: "offset" | "preset";
  minutes?: number;
  dayOffset?: number;
  time?: string;
  labelKey?: string;
};

const TIME_CHOICES: TimeChoiceDef[] = [
  {
    id: "time::now",
    titleKey: "schedule.time.option.now",
    descriptionKey: "schedule.time.option.now.description",
    type: "offset",
    minutes: 0,
  },
  {
    id: "time::30m",
    titleKey: "schedule.time.option.30m",
    descriptionKey: "schedule.time.option.30m.description",
    type: "offset",
    minutes: 30,
  },
  {
    id: "time::1h",
    titleKey: "schedule.time.option.1h",
    descriptionKey: "schedule.time.option.1h.description",
    type: "offset",
    minutes: 60,
  },
  {
    id: "time::2h",
    titleKey: "schedule.time.option.2h",
    descriptionKey: "schedule.time.option.2h.description",
    type: "offset",
    minutes: 120,
  },
  {
    id: "time::5h",
    titleKey: "schedule.time.option.5h",
    descriptionKey: "schedule.time.option.5h.description",
    type: "offset",
    minutes: 300,
  },
  {
    id: "time::tomorrow_am",
    titleKey: "schedule.time.option.tomorrow_morning",
    descriptionKey: "schedule.time.option.tomorrow_morning.description",
    type: "preset",
    dayOffset: 1,
    time: "08:00",
  },
  {
    id: "time::tomorrow_pm",
    titleKey: "schedule.time.option.tomorrow_evening",
    descriptionKey: "schedule.time.option.tomorrow_evening.description",
    type: "preset",
    dayOffset: 1,
    time: "18:00",
  },
  {
    id: "time::every_morning",
    titleKey: "schedule.time.option.every_morning",
    descriptionKey: "schedule.time.option.every_morning.description",
    type: "preset",
    dayOffset: 1,
    time: "07:30",
    labelKey: "schedule.time.label.every_morning",
  },
  {
    id: "time::every_evening",
    titleKey: "schedule.time.option.every_evening",
    descriptionKey: "schedule.time.option.every_evening.description",
    type: "preset",
    dayOffset: 1,
    time: "17:30",
    labelKey: "schedule.time.label.every_evening",
  },
];

const LEGACY_TIME_IDS: Record<string, string> = {
  now: "time::now",
  "30min": "time::30m",
  "1hour": "time::1h",
  "2hours": "time::2h",
  "5hours": "time::5h",
  tomorrow_morning: "time::tomorrow_am",
  tomorrow_evening: "time::tomorrow_pm",
  every_morning: "time::every_morning",
  every_evening: "time::every_evening",
};

export interface ScheduleState {
  role?: "driver" | "passenger";
  vehicle?: string;
  tripId?: string;
  origin?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number } | null;
  originFavoriteId?: string | null;
  dropoffFavoriteId?: string | null;
  travelDate?: string | null;
  travelTime?: string | null;
  travelLabel?: string | null;
  timezone?: string | null;
  rows?: ScheduleRow[];
}

interface ScheduleRow {
  id: string;
  whatsapp: string;
  ref: string;
  tripId: string;
}

export type ScheduleSavedPickerState = {
  source: "schedule";
  stage: "pickup" | "dropoff";
  state: ScheduleState;
};

function getMatchTimestamp(match: MatchResult): string | null {
  return match.matched_at ?? match.created_at ?? null;
}

function timestampMs(match: MatchResult): number {
  const ts = getMatchTimestamp(match);
  return ts ? Date.parse(ts) : 0;
}

export async function startScheduleTrip(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_role",
    data: {},
  });
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "schedule.menu.title"),
      body: t(ctx.locale, "schedule.menu.body"),
      sectionTitle: t(ctx.locale, "schedule.menu.section"),
      buttonText: t(ctx.locale, "schedule.menu.button"),
      rows: buildRoleRows(ctx),
    },
    { emoji: "🚦" },
  );
  return true;
}

export async function handleScheduleRole(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const role = id === IDS.ROLE_DRIVER
    ? "driver"
    : id === IDS.ROLE_PASSENGER
    ? "passenger"
    : null;
  if (!role) return false;
  if (role === "driver") {
    const ready = await ensureVehiclePlate(ctx, {
      type: "schedule_role",
      roleId: id,
    });
    if (!ready) return true;
    const storedVehicle = await getStoredVehicleType(
      ctx.supabase,
      ctx.profileId,
    );
    if (storedVehicle) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "schedule_location",
        data: { role, vehicle: storedVehicle },
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "schedule.pickup.prompt"),
        sharePickupButtons(ctx, role, { allowChange: true }),
      );
      return true;
    }
  }
  await promptScheduleVehicleSelection(ctx, role);
  return true;
}

export async function handleScheduleSkipDropoff(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) {
    return false;
  }
  if (!state.origin) {
    await sendText(ctx.from, t(ctx.locale, "schedule.pickup.missing"));
    return true;
  }
  if (state.tripId) {
    return await createTripAndDeliverMatches(ctx, state, {
      dropoff: null,
      travelLabel: state.travelLabel ??
        formatTravelLabel(
          ctx.locale,
          state.travelDate ?? null,
          state.travelTime ?? null,
          state.timezone ?? DEFAULT_TIMEZONE,
        ),
    });
  }
  const nextState: ScheduleState = {
    role: state.role,
    vehicle: state.vehicle,
    origin: state.origin,
    dropoff: null,
    originFavoriteId: state.originFavoriteId ?? null,
    dropoffFavoriteId: state.dropoffFavoriteId ?? null,
  };
  return await requestScheduleTime(ctx, nextState);
}

export async function handleScheduleVehicle(
  ctx: RouterContext,
  state: ScheduleState,
  vehicleId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.role) return false;
  const vehicleType = vehicleFromId(vehicleId);
  if (state.role === "driver") {
    await updateStoredVehicleType(ctx.supabase, ctx.profileId, vehicleType);
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_location",
    data: {
      role: state.role,
      vehicle: vehicleType,
    },
  });
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "schedule.pickup.prompt"),
    sharePickupButtons(ctx, state.role, {
      allowChange: state.role === "driver",
    }),
  );
  return true;
}

export async function handleScheduleChangeVehicle(
  ctx: RouterContext,
  data: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const roleValue = typeof data?.role === "string" ? data.role : null;
  const role = roleValue === "driver"
    ? "driver"
    : roleValue === "passenger"
    ? "passenger"
    : null;
  if (!role) return false;
  await promptScheduleVehicleSelection(ctx, role);
  return true;
}

export async function handleScheduleLocation(
  ctx: RouterContext,
  state: ScheduleState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_dropoff",
    data: {
      role: state.role,
      vehicle: state.vehicle,
      origin: coords,
      originFavoriteId: state.originFavoriteId ?? null,
    },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "schedule.dropoff.prompt"),
    shareDropoffButtons(ctx),
  );
  return true;
}

export async function handleScheduleDropoff(
  ctx: RouterContext,
  state: ScheduleState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle) {
    return false;
  }
  if (!state.tripId) {
    if (!state.origin) {
      await sendText(ctx.from, t(ctx.locale, "schedule.pickup.missing"));
      return true;
    }
    const nextState: ScheduleState = {
      role: state.role,
      vehicle: state.vehicle,
      origin: state.origin,
      dropoff: coords,
      originFavoriteId: state.originFavoriteId ?? null,
      dropoffFavoriteId: state.dropoffFavoriteId ?? null,
    };
    return await requestScheduleTime(ctx, nextState);
  }
  try {
    // Use the same search radius we use for pickup to avoid NULL not-null violations
    const config = await getAppConfig(ctx.supabase);
    const radiusMetersForDropoff = kmToMeters(config.search_radius_km ?? 10);
    await updateTripDropoff(ctx.supabase, {
      tripId: state.tripId,
      lat: coords.lat,
      lng: coords.lng,
      radiusMeters: radiusMetersForDropoff,
    });

    const context: ScheduleState = {
      ...state,
      dropoff: coords,
    };

    const radiusMeters = radiusMetersForDropoff;
    const max = config.max_results ?? 9;

    const matches = await fetchMatches(ctx, context, {
      preferDropoff: true,
      limit: max,
      radiusMeters,
    });

    await deliverMatches(ctx, context, matches, {
      messagePrefix: t(ctx.locale, "schedule.dropoff.saved"),
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_dropoff_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage: "dropoff",
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage: "dropoff",
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "schedule.errors.match_dropoff"),
      shareDropoffButtons(ctx),
    );
    return true;
  }
}

async function requestScheduleTime(
  ctx: RouterContext,
  state: ScheduleState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_time_select",
    data: state,
  });

  const rows = [
    ...buildTimeOptionRows(ctx),
    {
      id: IDS.BACK_MENU,
      title: t(ctx.locale, "common.menu_back"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "schedule.time.title"),
      body: t(ctx.locale, "schedule.time.prompt"),
      sectionTitle: t(ctx.locale, "schedule.time.section"),
      rows,
      buttonText: t(ctx.locale, "schedule.time.button"),
    },
    { emoji: "🕐" },
  );
  return true;
}

export async function handleScheduleTimeSelection(
  ctx: RouterContext,
  state: ScheduleState,
  choiceId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle || !state.origin) {
    return false;
  }
  const normalizedChoiceId = LEGACY_TIME_IDS[choiceId] ?? choiceId;
  const choice = TIME_CHOICES.find((option) =>
    option.id === normalizedChoiceId
  );
  if (!choice) return false;
  const timezone = state.timezone ?? DEFAULT_TIMEZONE;
  const selection = computeTimeSelection(choice, timezone);
  if (!selection) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "schedule.time.invalid"),
      homeOnly(),
    );
    return true;
  }
  const travelLabel = choice.labelKey
    ? t(ctx.locale, choice.labelKey)
    : formatTravelLabel(
      ctx.locale,
      selection.travelDate,
      selection.travelTime,
      timezone,
    );
  const nextState: ScheduleState = {
    ...state,
    travelDate: selection.travelDate,
    travelTime: selection.travelTime,
    timezone,
    travelLabel,
  };
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_recur",
    data: nextState as Record<string, unknown>,
  });
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "schedule.time.saved", { datetime: travelLabel }),
    buildRecurrenceButtons(ctx),
  );
  return true;
}

function buildTimeOptionRows(ctx: RouterContext) {
  return TIME_CHOICES.map((choice) => ({
    id: choice.id,
    title: t(ctx.locale, choice.titleKey),
    description: choice.descriptionKey
      ? t(ctx.locale, choice.descriptionKey)
      : undefined,
  }));
}

function computeTimeSelection(
  choice: TimeChoiceDef,
  timezone: string,
): { travelDate: string; travelTime: string } | null {
  if (choice.type === "offset") {
    const minutes = choice.minutes ?? 0;
    const target = new Date(Date.now() + minutes * 60_000);
    return formatZonedDate(target, timezone);
  }
  if (choice.type === "preset") {
    const dayOffset = choice.dayOffset ?? 0;
    const target = new Date(Date.now() + dayOffset * DAY_MS);
    const { travelDate } = formatZonedDate(target, timezone);
    return {
      travelDate,
      travelTime: choice.time ?? "08:00",
    };
  }
  return null;
}

function formatZonedDate(
  date: Date,
  timezone: string,
): { travelDate: string; travelTime: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((entry) => entry.type === type);
    return part?.value ?? "00";
  };
  return {
    travelDate: `${get("year")}-${get("month")}-${get("day")}`,
    travelTime: `${get("hour")}:${get("minute")}`,
  };
}

function buildRecurrenceButtons(ctx: RouterContext): ButtonSpec[] {
  return [
    {
      id: IDS.SCHEDULE_RECUR_NONE,
      title: t(ctx.locale, "schedule.recur.none.button"),
    },
    {
      id: IDS.SCHEDULE_RECUR_WEEKDAYS,
      title: t(ctx.locale, "schedule.recur.weekdays.button"),
    },
    {
      id: IDS.SCHEDULE_RECUR_DAILY,
      title: t(ctx.locale, "schedule.recur.daily.button"),
    },
  ];
}

export async function startScheduleSavedLocationPicker(
  ctx: RouterContext,
  state: ScheduleState,
  stage: "pickup" | "dropoff",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorites = await listFavorites(ctx);
  await setState(ctx.supabase, ctx.profileId, {
    key: "location_saved_picker",
    data: {
      source: "schedule",
      stage,
      state,
    } satisfies ScheduleSavedPickerState,
  });
  const baseBody = t(ctx.locale, "location.saved.list.body", {
    context: stage === "pickup"
      ? t(ctx.locale, "location.context.pickup")
      : t(ctx.locale, "location.context.dropoff"),
  });
  const body = favorites.length
    ? baseBody
    : `${baseBody}\n\n${t(ctx.locale, "location.saved.list.empty")}`;
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.list.title"),
      body,
      sectionTitle: t(ctx.locale, "location.saved.list.section"),
      rows: [
        ...favorites.map((fav) => scheduleFavoriteToRow(fav)),
        ...buildSaveRows(ctx),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "location.saved.list.button"),
    },
    { emoji: "⭐" },
  );
  return true;
}

export async function handleScheduleSavedLocationSelection(
  ctx: RouterContext,
  pickerState: ScheduleSavedPickerState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorite = await getFavoriteById(ctx, selectionId);
  if (!favorite) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.list.expired"),
      buildButtons({
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      }),
    );
    return true;
  }
  const coords = { lat: favorite.lat, lng: favorite.lng };
  if (pickerState.stage === "pickup") {
    return await handleScheduleLocation(
      ctx,
      { ...pickerState.state, originFavoriteId: favorite.id },
      coords,
    );
  }
  return await handleScheduleDropoff(
    ctx,
    { ...pickerState.state, dropoffFavoriteId: favorite.id },
    coords,
  );
}


function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5); // HH:MM
}

export async function handleScheduleRecurrenceSelection(
  ctx: RouterContext,
  state: ScheduleState,
  choiceId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.role || !state.vehicle || !state.origin) {
    return false;
  }
  const recurrence = parseRecurrenceChoice(choiceId);
  if (!recurrence) return false;

  if (!state.travelTime) {
    await sendText(ctx.from, t(ctx.locale, "schedule.time.missing"));
    return true;
  }

  if (recurrence !== "none") {
    const saved = await saveRecurringTrip(ctx, state, recurrence);
    if (!saved) return true;
  }

  await createTripAndDeliverMatches(
    ctx,
    state,
    {
      dropoff: state.dropoff ?? null,
      travelLabel: state.travelLabel ??
        formatTravelLabel(
          ctx.locale,
          state.travelDate ?? null,
          state.travelTime ?? null,
          state.timezone ?? DEFAULT_TIMEZONE,
        ),
    },
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

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
    key: "schedule_dropoff",
    data: { ...state },
  });
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "schedule.dropoff.instructions"),
    shareDropoffButtons(ctx),
  );
  return true;
}

async function createTripAndDeliverMatches(
  ctx: RouterContext,
  state: ScheduleState,
  options: {
    dropoff: { lat: number; lng: number } | null;
    travelLabel?: string | null;
  },
): Promise<boolean> {
  if (!state.origin) throw new Error("Missing pickup location");
  const config = await getAppConfig(ctx.supabase);
  const radiusMeters = kmToMeters(config.search_radius_km ?? 10);
  const max = config.max_results ?? 9;
  let tripId: string | null = null;
  const stage = options.dropoff ? "dropoff" : "origin";

  try {
    tripId = await insertTrip(ctx.supabase, {
      userId: ctx.profileId!,
      role: state.role!,
      vehicleType: state.vehicle!,
      lat: state.origin.lat,
      lng: state.origin.lng,
      radiusMeters,
      pickupText: options.travelLabel ?? undefined,
    });

    if (options.dropoff) {
      await updateTripDropoff(ctx.supabase, {
        tripId,
        lat: options.dropoff.lat,
        lng: options.dropoff.lng,
        // Ensure dropoff radius is set to avoid NOT NULL violations
        radiusMeters,
      });
    }

    const context: ScheduleState = {
      role: state.role,
      vehicle: state.vehicle,
      tripId,
      origin: state.origin,
      dropoff: options.dropoff,
      originFavoriteId: state.originFavoriteId ?? null,
      dropoffFavoriteId: options.dropoff
        ? (state.dropoffFavoriteId ?? null)
        : null,
      travelLabel: options.travelLabel ?? null,
      travelDate: state.travelDate ?? null,
      travelTime: state.travelTime ?? null,
      timezone: state.timezone ?? DEFAULT_TIMEZONE,
    };

    const matches = await fetchMatches(ctx, context, {
      preferDropoff: Boolean(options.dropoff),
      limit: max,
      radiusMeters,
    });

    const messagePrefix = options.travelLabel
      ? t(ctx.locale, "schedule.trip.created_at", {
        datetime: options.travelLabel,
      })
      : t(ctx.locale, "schedule.trip.created");

    await deliverMatches(ctx, context, matches, {
      messagePrefix,
      radiusMeters,
    });
    return true;
  } catch (error) {
    console.error("mobility.schedule_create_fail", error);
    await logStructuredEvent("MATCHES_ERROR", {
      flow: "schedule",
      stage,
      role: state.role,
      vehicle: state.vehicle,
      wa_id: maskPhone(ctx.from),
    });
    await emitAlert("MATCHES_ERROR", {
      flow: "schedule",
      stage,
      role: state.role,
      vehicle: state.vehicle,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
    if (tripId) {
      const followUp = t(ctx.locale, "schedule.trip.saved_followup");

      const browseButton: ButtonSpec = state.role === "passenger"
        ? {
          id: IDS.SEE_DRIVERS,
          title: t(ctx.locale, "home.rows.seeDrivers.title"),
        }
        : {
          id: IDS.SEE_PASSENGERS,
          title: t(ctx.locale, "home.rows.seePassengers.title"),
        };

      await sendButtonsMessage(
        ctx,
        followUp,
        [
          browseButton,
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ],
      );
    } else {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "schedule.errors.service_unavailable"),
        buildButtons({
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        }),
      );
    }

    await clearState(ctx.supabase, ctx.profileId!);
    return true;
  }
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
    ],
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

export function isScheduleRole(id: string): boolean {
  return id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER;
}

export function isScheduleResult(id: string): boolean {
  return id.startsWith("MTCH::");
}

function sharePickupButtons(
  ctx: RouterContext,
  role?: "driver" | "passenger",
  options: { allowChange?: boolean } = {},
): ButtonSpec[] {
  const buttons: ButtonSpec[] = [];
  if (role === "driver" && options.allowChange) {
    buttons.push({
      id: IDS.MOBILITY_CHANGE_VEHICLE,
      title: t(ctx.locale, "mobility.nearby.change_vehicle"),
    });
  }
  buttons.push({
    id: IDS.LOCATION_SAVED_LIST,
    title: t(ctx.locale, "location.saved.button"),
  });
  const [primary, ...rest] = buttons;
  return buildButtons(primary, ...rest);
}

function shareDropoffButtons(ctx: RouterContext): ButtonSpec[] {
  return buildButtons(
    {
      id: IDS.SCHEDULE_SKIP_DROPOFF,
      title: t(ctx.locale, "common.buttons.skip"),
    },
    {
      id: IDS.LOCATION_SAVED_LIST,
      title: t(ctx.locale, "location.saved.button"),
    },
    { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
  );
}

async function promptScheduleVehicleSelection(
  ctx: RouterContext,
  role: "driver" | "passenger",
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, {
    key: "schedule_vehicle",
    data: { role },
  });
  await sendListMessage(
    ctx,
    {
      title: role === "driver"
        ? t(ctx.locale, "schedule.vehicle.prompt.driver")
        : t(ctx.locale, "schedule.vehicle.prompt.passenger"),
      body: t(ctx.locale, "schedule.vehicle.body"),
      sectionTitle: t(ctx.locale, "schedule.vehicle.section"),
      rows: VEHICLE_OPTIONS,
      buttonText: t(ctx.locale, "common.buttons.select"),
    },
    { emoji: role === "driver" ? "🚗" : "🧍" },
  );
}

function kmToMeters(km: number | null | undefined): number {
  if (!km || Number.isNaN(km)) return REQUIRED_RADIUS_METERS;
  return Math.min(
    Math.max(Math.round(km * 1000), REQUIRED_RADIUS_METERS),
    REQUIRED_RADIUS_METERS,
  );
}

function parseRecurrenceChoice(
  id: string,
): "none" | "weekdays" | "daily" | null {
  if (id === IDS.SCHEDULE_RECUR_NONE) return "none";
  if (id === IDS.SCHEDULE_RECUR_WEEKDAYS) return "weekdays";
  if (id === IDS.SCHEDULE_RECUR_DAILY) return "daily";
  return null;
}

async function saveRecurringTrip(
  ctx: RouterContext,
  state: ScheduleState,
  recurrence: "weekdays" | "daily",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const pickupFavoriteId = await ensureFavoriteForCoords(
    ctx,
    state.originFavoriteId,
    state.origin,
    t(ctx.locale, "schedule.recur.auto_pickup_label"),
  );
  const dropFavoriteId = await ensureFavoriteForCoords(
    ctx,
    state.dropoffFavoriteId,
    state.dropoff,
    t(ctx.locale, "schedule.recur.auto_dropoff_label"),
  );
  if (!pickupFavoriteId || !dropFavoriteId) {
    await sendText(ctx.from, t(ctx.locale, "schedule.recur.missing_locations"));
    return false;
  }
  const daysOfWeek = recurrence === "weekdays"
    ? [1, 2, 3, 4, 5]
    : [1, 2, 3, 4, 5, 6, 7];
  const { error } = await ctx.supabase.from("recurring_trips").insert({
    user_id: ctx.profileId,
    origin_favorite_id: pickupFavoriteId,
    dest_favorite_id: dropFavoriteId,
    days_of_week: daysOfWeek,
    time_local: state.travelTime!,
    timezone: state.timezone ?? DEFAULT_TIMEZONE,
  });
  if (error) {
    console.error("mobility.schedule_recurring_fail", error);
    await sendText(ctx.from, t(ctx.locale, "schedule.recur.error"));
    return false;
  }
  await sendText(ctx.from, t(ctx.locale, "schedule.recur.saved"));
  return true;
}

async function ensureFavoriteForCoords(
  ctx: RouterContext,
  favoriteId: string | null | undefined,
  coords: { lat: number; lng: number } | null | undefined,
  fallbackLabel: string,
): Promise<string | null> {
  if (favoriteId) return favoriteId;
  if (!coords) return null;
  const saved = await saveFavorite(ctx, "other", coords, {
    label: fallbackLabel,
  });
  return saved?.id ?? null;
}

async function fetchMatches(
  ctx: RouterContext,
  state: ScheduleState,
  options: {
    preferDropoff: boolean;
    limit: number;
    radiusMeters: number;
  },
): Promise<MatchResult[]> {
  const matches = state.role === "passenger"
    ? await matchDriversForTrip(
      ctx.supabase,
      state.tripId!,
      options.limit,
      options.preferDropoff,
      options.radiusMeters,
      DEFAULT_WINDOW_DAYS,
    )
    : await matchPassengersForTrip(
      ctx.supabase,
      state.tripId!,
      options.limit,
      options.preferDropoff,
      options.radiusMeters,
      DEFAULT_WINDOW_DAYS,
    );
  return matches.sort(sortMatches).slice(0, 9);
}

async function deliverMatches(
  ctx: RouterContext,
  state: ScheduleState,
  matches: MatchResult[],
  meta: { messagePrefix: string; radiusMeters: number },
): Promise<void> {
  await logStructuredEvent("MATCHES_RESULT", {
    flow: "schedule",
    role: state.role,
    trip_id: state.tripId,
    count: matches.length,
  });

  const rows = matches.map((match) => buildScheduleRow(ctx, match));

  await setState(ctx.supabase, ctx.profileId!, {
    key: "schedule_results",
    data: {
      ...state,
      rows: rows.map((r) => r.state),
    },
  });

  const tapInstruction = t(ctx.locale, "schedule.matches.tap_to_chat");
  const waitingInstruction = t(ctx.locale, "schedule.matches.waiting");
  const notifyInstruction = t(ctx.locale, "schedule.matches.notify");
  const body = matches.length
    ? `${meta.messagePrefix}\n${tapInstruction}`
    : `${meta.messagePrefix}\n${waitingInstruction}`;

  if (!matches.length) {
    await sendText(
      ctx.from,
      `${body}\n${notifyInstruction}`,
    );
    return;
  }

  await sendListWithActions(
    ctx,
    {
      title: state.role === "passenger"
        ? t(ctx.locale, "schedule.list.title.drivers")
        : t(ctx.locale, "schedule.list.title.passengers"),
      body,
      sectionTitle: t(ctx.locale, "schedule.matches.section"),
      rows: rows.map((r) => r.row),
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    matchActionButtons(state),
  );
}

function matchActionButtons(_state: ScheduleState): ButtonSpec[] {
  return [];
}

function buildScheduleRow(
  ctx: RouterContext,
  match: MatchResult,
): {
  row: { id: string; title: string; description?: string };
  state: ScheduleRow;
} {
  const masked = maskPhone(match.whatsapp_e164 ?? "");
  const distanceLabel = typeof match.distance_km === "number"
    ? toDistanceLabel(match.distance_km)
    : null;
  const seenLabel = timeAgo(
    getMatchTimestamp(match) ?? new Date().toISOString(),
  );
  const details = [
    t(ctx.locale, "schedule.match.row.ref", { ref: match.ref_code ?? "---" }),
    distanceLabel
      ? t(ctx.locale, "schedule.match.row.distance", {
        distance: distanceLabel,
      })
      : null,
    t(ctx.locale, "schedule.match.row.seen", { time: seenLabel }),
  ].filter(Boolean).join(" • ");
  const rowId = `MTCH::${match.trip_id}`;
  return {
    row: {
      id: rowId,
      title: masked,
      description: details,
    },
    state: {
      id: rowId,
      whatsapp: match.whatsapp_e164 ?? "",
      ref: match.ref_code ?? "---",
      tripId: match.trip_id,
    },
  };
}

function scheduleFavoriteToRow(
  favorite: UserFavorite,
): { id: string; title: string; description?: string } {
  return {
    id: favorite.id,
    title: `⭐ ${favorite.label}`,
    description: favorite.address ??
      `${favorite.lat.toFixed(4)}, ${favorite.lng.toFixed(4)}`,
  };
}

function buildRoleRows(ctx: RouterContext) {
  return [
    {
      id: IDS.ROLE_PASSENGER,
      title: t(ctx.locale, "schedule.role.passenger.title"),
      description: t(ctx.locale, "schedule.role.passenger.description"),
    },
    {
      id: IDS.ROLE_DRIVER,
      title: t(ctx.locale, "schedule.role.driver.title"),
      description: t(ctx.locale, "schedule.role.driver.description"),
    },
    {
      id: IDS.BACK_MENU,
      title: t(ctx.locale, "common.menu_back"),
      description: t(ctx.locale, "common.back_to_menu.description"),
    },
  ];
}

function toDistanceLabel(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1) return `${value.toFixed(1)} km`;
  return `${Math.round(value * 1000)} m`;
}

function sortMatches(a: MatchResult, b: MatchResult): number {
  const timeA = timestampMs(a);
  const timeB = timestampMs(b);
  if (timeB !== timeA) return timeB - timeA;
  const distA = typeof a.distance_km === "number"
    ? a.distance_km
    : Number.MAX_SAFE_INTEGER;
  const distB = typeof b.distance_km === "number"
    ? b.distance_km
    : Number.MAX_SAFE_INTEGER;
  return distA - distB;
}

export function formatTravelLabel(
  locale: string,
  date: string | null,
  time: string | null,
  timezone: string | null,
): string {
  if (!date || !time) return "";
  const zone = timezone ?? DEFAULT_TIMEZONE;
  let dateLabel = date;
  try {
    dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  } catch {
    // ignore formatter failures
  }
  return `${dateLabel} · ${time} (${zone})`;
}
