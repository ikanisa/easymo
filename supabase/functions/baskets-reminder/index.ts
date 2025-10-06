import { serve } from "../wa-webhook/deps.ts";
import type { SupabaseClient } from "../wa-webhook/deps.ts";
import { supabase } from "../wa-webhook/config.ts";
import { queueNotification } from "../wa-webhook/notify/sender.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";
import { emitAlert } from "../wa-webhook/observe/alert.ts";

const BATCH_SIZE = Math.max(
  Number(Deno.env.get("BASKETS_REMINDER_BATCH_SIZE") ?? "20") || 20,
  1,
);
const THROTTLE_DEFAULT =
  Number(Deno.env.get("BASKETS_REMINDER_MAX_PER_HOUR") ?? "30") || 30;
const CRON_EXPR = "*/5 * * * *";
const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};
const CRON_ENABLED =
  (Deno.env.get("BASKETS_REMINDER_CRON_ENABLED") ?? "false").toLowerCase() ===
    "true";

interface ReminderRow {
  id: string;
  member_id: string | null;
  reminder_type: string;
  status: string;
  scheduled_for: string;
  next_attempt_at: string | null;
  attempts: number;
  blocked_reason: string | null;
  meta: Record<string, unknown> | null;
  member: {
    profiles?: {
      whatsapp_e164?: string | null;
      display_name?: string | null;
    } | null;
  } | null;
}

type TemplateConfig = Record<string, string>;

type QuietHoursConfig = {
  start: string;
  end: string;
};

async function fetchSettings(client: SupabaseClient) {
  const { data, error } = await client
    .from("settings")
    .select("key, value")
    .in("key", [
      "baskets.templates",
      "baskets.quiet_hours",
      "baskets.reminder_throttle",
    ]);

  if (error) {
    console.error("reminder.fetch_settings_failed", error);
    throw error;
  }

  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    map.set(row.key, row.value);
  }

  const templates = map.get("baskets.templates") as TemplateConfig | undefined;
  const quietHours = map.get("baskets.quiet_hours") as
    | QuietHoursConfig
    | undefined;
  const throttleSetting = map.get("baskets.reminder_throttle");
  const throttle = typeof throttleSetting === "number"
    ? throttleSetting
    : typeof throttleSetting === "object" && throttleSetting !== null
    ? Number(
      (throttleSetting as { per_hour?: number }).per_hour ?? THROTTLE_DEFAULT,
    )
    : THROTTLE_DEFAULT;

  return {
    templates: templates ?? {},
    quietHours: quietHours ?? { start: "22:00", end: "06:00" },
    throttle: throttle > 0 ? throttle : THROTTLE_DEFAULT,
  };
}

function isWithinQuietHours(config: QuietHoursConfig, now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = config.start.split(":").map(Number);
  const [endH, endM] = config.end.split(":").map(Number);
  const startMinutes = Number.isFinite(startH) && Number.isFinite(startM)
    ? startH * 60 + startM
    : 22 * 60;
  const endMinutes = Number.isFinite(endH) && Number.isFinite(endM)
    ? endH * 60 + endM
    : 6 * 60;
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

function nextQuietWindowEnd(config: QuietHoursConfig, reference: Date): Date {
  const [endH, endM] = config.end.split(":").map(Number);
  const end = new Date(reference);
  end.setHours(endH ?? 6, endM ?? 0, 0, 0);
  if (end <= reference) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

async function fetchPendingReminders(client: SupabaseClient, limit: number) {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("baskets_reminders")
    .select(
      `id, member_id, reminder_type, status, scheduled_for, next_attempt_at, attempts, blocked_reason, meta,
       member:member_id ( profiles:user_id ( whatsapp_e164, display_name ) )
      `,
    )
    .in("status", ["pending", "blocked"])
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("reminder.fetch_pending_failed", error);
    throw error;
  }

  return (data ?? []) as ReminderRow[];
}

function recipientWa(reminder: ReminderRow): string | null {
  const wa = reminder.member?.profiles?.whatsapp_e164 ?? null;
  if (!wa) return null;
  return wa.startsWith("+") ? wa : `+${wa}`;
}

async function logReminderEvent(
  client: SupabaseClient,
  reminderId: string,
  event: string,
  reason?: string,
  context?: Record<string, unknown>,
) {
  const payload = {
    reminder_id: reminderId,
    event,
    reason: reason ?? null,
    context: context ?? {},
  };
  const { error } = await client.from("baskets_reminder_events").insert(
    payload,
  );
  if (error) {
    console.error("reminder.event_log_failed", { reminderId, event, error });
  }
}

async function updateReminder(
  client: SupabaseClient,
  reminderId: string,
  values: Record<string, unknown>,
) {
  const { error } = await client
    .from("baskets_reminders")
    .update(values)
    .eq("id", reminderId);
  if (error) {
    console.error("reminder.update_failed", { reminderId, error });
  }
}

async function countRecentReminderSends(
  client: SupabaseClient,
): Promise<number> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("notification_type", "baskets_reminder")
    .gte("created_at", windowStart);
  if (error) {
    console.error("reminder.throttle_count_failed", error);
    return 0;
  }
  return count ?? 0;
}

async function queueReminderSend(
  reminder: ReminderRow,
  template: string,
): Promise<string> {
  const waId = recipientWa(reminder);
  if (!waId) {
    throw new Error("missing_recipient");
  }

  const result = await queueNotification({
    to: waId,
    template: { name: template, language: "en" },
  }, {
    type: "baskets_reminder",
    reminderId: reminder.id,
  });

  return result.id;
}

async function runReminderWorker(trigger: "http" | "cron") {
  await logStructuredEvent("REMINDER_WORKER_START", { trigger });
  const summary = {
    processed: 0,
    queued: 0,
    blocked: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const settings = await fetchSettings(supabase);
    const reminders = await fetchPendingReminders(supabase, BATCH_SIZE);
    const now = new Date();
    let throttleLedger = await countRecentReminderSends(supabase);

    for (const reminder of reminders) {
      summary.processed += 1;
      const nextAttempt = reminder.next_attempt_at
        ? new Date(reminder.next_attempt_at)
        : null;
      if (nextAttempt && nextAttempt.getTime() > now.getTime()) {
        continue;
      }

      try {
        if (isWithinQuietHours(settings.quietHours, now)) {
          const resumeAt = nextQuietWindowEnd(settings.quietHours, now);
          await updateReminder(supabase, reminder.id, {
            status: "blocked",
            blocked_reason: "quiet_hours",
            next_attempt_at: resumeAt.toISOString(),
          });
          await logReminderEvent(
            supabase,
            reminder.id,
            "blocked",
            "quiet_hours",
            {
              resume_at: resumeAt.toISOString(),
            },
          );
          summary.blocked += 1;
          continue;
        }

        if (throttleLedger >= settings.throttle) {
          const retryAt = new Date(now.getTime() + 30 * 60 * 1000);
          await updateReminder(supabase, reminder.id, {
            status: "blocked",
            blocked_reason: "throttled",
            next_attempt_at: retryAt.toISOString(),
          });
          await logReminderEvent(
            supabase,
            reminder.id,
            "blocked",
            "throttled",
            {
              resume_at: retryAt.toISOString(),
              throttle_limit: settings.throttle,
            },
          );
          summary.blocked += 1;
          continue;
        }

        const template = settings.templates?.[reminder.reminder_type];
        if (!template) {
          await updateReminder(supabase, reminder.id, {
            status: "skipped",
            blocked_reason: "template_missing",
          });
          await logReminderEvent(
            supabase,
            reminder.id,
            "skipped",
            "template_missing",
          );
          summary.skipped += 1;
          continue;
        }

        const waId = recipientWa(reminder);
        if (!waId) {
          await updateReminder(supabase, reminder.id, {
            status: "skipped",
            blocked_reason: "missing_msisdn",
          });
          await logReminderEvent(
            supabase,
            reminder.id,
            "skipped",
            "missing_msisdn",
          );
          summary.skipped += 1;
          continue;
        }

        const notificationId = await queueReminderSend(reminder, template);
        throttleLedger += 1;

        await updateReminder(supabase, reminder.id, {
          status: "queued",
          blocked_reason: null,
          next_attempt_at: null,
          attempts: reminder.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          notification_id: notificationId,
        });
        await logReminderEvent(supabase, reminder.id, "queued", undefined, {
          template,
          to: waId,
        });
        summary.queued += 1;
      } catch (error) {
        console.error("reminder.process_failed", { id: reminder.id, error });
        const reason = error instanceof Error
          ? error.message
          : "unexpected_error";
        await updateReminder(supabase, reminder.id, {
          status: "blocked",
          blocked_reason: reason,
          next_attempt_at: new Date(now.getTime() + 60 * 60 * 1000)
            .toISOString(),
        });
        await logReminderEvent(supabase, reminder.id, "blocked", reason);
        summary.errors += 1;
      }
    }

    await logStructuredEvent("REMINDER_WORKER_DONE", { trigger, ...summary });
    return summary;
  } catch (error) {
    console.error("reminder.worker_failed", error);
    await emitAlert("REMINDER_WORKER_ERROR", {
      trigger,
      error: error instanceof Error
        ? error.message
        : String(error ?? "unknown_error"),
    });
    throw error;
  }
}

serve(async (_request) => {
  try {
    const result = await runReminderWorker("http");
    return new Response(JSON.stringify({ ok: true, summary: result }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    return new Response(message, { status: 500 });
  }
});

if (typeof denoWithCron.cron === "function" && CRON_ENABLED) {
  denoWithCron.cron("baskets-reminder-worker", CRON_EXPR, async () => {
    try {
      await runReminderWorker("cron");
    } catch (error) {
      console.error("reminder.cron_failed", error);
      await emitAlert("REMINDER_CRON_ERROR", {
        schedule: CRON_EXPR,
        error: error instanceof Error
          ? error.message
          : String(error ?? "unknown"),
      });
    }
  });
  await logStructuredEvent("REMINDER_CRON_STATUS", {
    enabled: true,
    schedule: CRON_EXPR,
  });
}
