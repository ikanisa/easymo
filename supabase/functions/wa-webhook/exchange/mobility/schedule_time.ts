import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import type { RouterContext } from "../../types.ts";
import { supabase } from "../../config.ts";
import { ensureProfile, getState, setState } from "../../state/store.ts";
import { resolveLanguage } from "../../i18n/language.ts";
import { t } from "../../i18n/translator.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import type { ScheduleState } from "../../domains/mobility/schedule.ts";
import { formatTravelLabel } from "../../domains/mobility/schedule.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_TIMEZONE = "Africa/Kigali";

export async function handleScheduleTimeFlow(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const locale = resolveLanguage(
    typeof req.context?.language === "string"
      ? req.context.language
      : undefined,
  );
  switch (req.action_id) {
    case "a_schedule_time_submit":
      return await handleTimeSubmit(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: t(locale, "schedule.time.flow_unknown_action"),
        }],
      };
  }
}

async function handleTimeSubmit(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const fallbackLocale = resolveLanguage(
    typeof req.context?.language === "string"
      ? req.context.language
      : undefined,
  );
  const waIdRaw = typeof req.wa_id === "string" ? req.wa_id.trim() : "";
  if (!waIdRaw) {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: t(fallbackLocale, "schedule.time.flow_missing_contact"),
      }],
    };
  }

  const profile = await ensureProfile(supabase, waIdRaw);
  const locale = resolveLanguage(profile.locale ?? undefined);
  const ctx: RouterContext = {
    supabase,
    from: profile.whatsapp_e164 ?? waIdRaw,
    profileId: profile.user_id,
    locale,
  };

  const travelDate = coerceDate(req.fields?.travel_date);
  const travelTime = coerceTime(req.fields?.travel_time);
  const timezone = coerceTimezone(req.fields?.travel_timezone);

  if (!travelDate || !travelTime) {
    await sendButtonsMessage(
      ctx,
      t(locale, "schedule.time.invalid"),
      buildRecurrenceButtons(locale),
    );
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: t(locale, "schedule.time.flow_missing_fields"),
      }],
    };
  }

  const state = await getState(supabase, profile.user_id);
  if (state.key !== "schedule_time_flow") {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "warning",
        text: t(locale, "schedule.time.flow_expired"),
      }],
    };
  }

  const currentState = (state.data ?? {}) as ScheduleState;
  const travelLabel = formatTravelLabel(locale, travelDate, travelTime, timezone);

  await setState(supabase, profile.user_id, {
    key: "schedule_recur",
    data: {
      ...currentState,
      travelDate,
      travelTime,
      timezone,
      travelLabel,
    },
  });

  await logStructuredEvent("SCHEDULE_TIME_CAPTURED", {
    wa_id: maskWa(waIdRaw),
    travel_date: travelDate,
    travel_time: travelTime,
    timezone,
  });

  await sendButtonsMessage(
    ctx,
    t(locale, "schedule.time.saved", { datetime: travelLabel }),
    buildRecurrenceButtons(locale),
  );

  return {
    next_screen_id: "s_schedule_time_saved",
    data: {
      travel_date: travelDate,
      travel_time: travelTime,
      timezone,
    },
    messages: [{
      level: "info",
      text: t(locale, "schedule.time.flow_captured"),
    }],
  };
}

function coerceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}

function coerceTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return TIME_PATTERN.test(trimmed) ? trimmed : null;
}

function coerceTimezone(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_TIMEZONE;
  const trimmed = value.trim();
  return trimmed || DEFAULT_TIMEZONE;
}

function maskWa(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

function buildRecurrenceButtons(locale: string) {
  return [
    {
      id: IDS.SCHEDULE_RECUR_NONE,
      title: t(locale, "schedule.recur.none.button"),
    },
    {
      id: IDS.SCHEDULE_RECUR_WEEKDAYS,
      title: t(locale, "schedule.recur.weekdays.button"),
    },
    {
      id: IDS.SCHEDULE_RECUR_DAILY,
      title: t(locale, "schedule.recur.daily.button"),
    },
  ];
}
