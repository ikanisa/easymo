import { serve } from "../wa-webhook/deps.ts";
import { json } from "shared/http.ts";
import type { SupabaseClient } from "../wa-webhook/deps.ts";
import { supabase } from "../wa-webhook/config.ts";
import {
  queueNotification,
  TEMPLATE_ORDER_PENDING_VENDOR,
} from "../wa-webhook/notify/sender.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";
import { emitAlert } from "../wa-webhook/observe/alert.ts";

const DEFAULT_THRESHOLD_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LANGUAGE = Deno.env.get("ORDER_PENDING_REMINDER_LANGUAGE") ??
  "en";
const CRON_EXPR = Deno.env.get("ORDER_PENDING_REMINDER_CRON") ?? "*/5 * * * *";
const CRON_ENABLED = (Deno.env.get("ORDER_PENDING_REMINDER_CRON_ENABLED") ?? "")
  .toLowerCase() === "true";

const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};

export function parseIntegerEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const THRESHOLD_MINUTES = parseIntegerEnv(
  "ORDER_PENDING_REMINDER_MINUTES",
  DEFAULT_THRESHOLD_MINUTES,
);
const BATCH_SIZE = parseIntegerEnv(
  "ORDER_PENDING_REMINDER_BATCH_SIZE",
  DEFAULT_BATCH_SIZE,
);

export type NotificationCandidate = {
  id: string;
  order_code?: string | null;
  bar_id: string | null;
  bar_name?: string | null;
  table_label?: string | null;
  created_at: string;
  staff_number?: string | null;
  bar?: {
    bar_numbers?:
      | Array<{
        number_e164: string | null;
        is_active: boolean | null;
      }>
      | null;
  } | null;
  order_events?:
    | Array<{
      type?: string | null;
      event_type?: string | null;
    }>
    | null;
};

type ReminderSummary = {
  processed: number;
  queued: number;
  skippedNoRecipients: number;
  alreadyNudged: number;
  errors: number;
};

export function hasVendorNudge(candidate: NotificationCandidate): boolean {
  return Boolean(
    candidate.order_events?.some((event) =>
      (event?.type ?? event?.event_type ?? "") === "vendor_nudge"
    ),
  );
}

export function collectRecipients(candidate: NotificationCandidate): string[] {
  const recipients = new Set<string>();

  const numbers = candidate.bar?.bar_numbers ?? [];
  for (const entry of numbers) {
    const value = entry?.number_e164?.trim();
    if (!value || entry?.is_active === false) continue;
    recipients.add(value.startsWith("+") ? value : `+${value}`);
  }

  if (candidate.staff_number) {
    const staff = candidate.staff_number.trim();
    if (staff.length) {
      recipients.add(staff.startsWith("+") ? staff : `+${staff}`);
    }
  }

  return Array.from(recipients);
}

async function fetchPendingOrders(
  client: SupabaseClient,
  thresholdIso: string,
  limit: number,
): Promise<NotificationCandidate[]> {
  const { data, error } = await client
    .from("orders")
    .select(
      `id, order_code, bar_id, bar_name, table_label, created_at, staff_number,
       bar:bar_id ( bar_numbers(number_e164, is_active) ),
       order_events(type, event_type)
      `,
    )
    .eq("status", "pending")
    .lte("created_at", thresholdIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as NotificationCandidate[];
}

async function queueVendorReminder(
  client: SupabaseClient,
  candidate: NotificationCandidate,
  recipients: string[],
  ageMinutes: number,
): Promise<number> {
  if (!recipients.length) return 0;

  const orderCode = candidate.order_code ?? candidate.id;
  const tableLabel = candidate.table_label ?? "-";

  const payload = {
    type: "body" as const,
    parameters: [
      { type: "text", text: orderCode },
      { type: "text", text: tableLabel },
      { type: "text", text: String(ageMinutes) },
    ],
  };

  const results = await Promise.allSettled(
    recipients.map((to) =>
      queueNotification({
        to,
        template: {
          name: TEMPLATE_ORDER_PENDING_VENDOR,
          language: DEFAULT_LANGUAGE,
          components: [payload],
        },
      }, {
        type: "order_pending_vendor",
        orderId: candidate.id,
        barId: candidate.bar_id,
        orderCode,
        tableLabel,
        ageMinutes,
        source: "order_pending_reminder",
      })
    ),
  );

  const successful = results.filter((result) => result.status === "fulfilled");

  if (successful.length) {
    await client.from("order_events").insert({
      order_id: candidate.id,
      event_type: "vendor_nudge",
      actor_type: "system",
      note: `Pending reminder queued for ${successful.length} recipient(s)`,
    });
  }

  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const record of rejected) {
      console.error("order-pending-reminder.queue_failed", record);
    }
    if (!successful.length) {
      throw new Error(
        `Unable to queue reminder for order ${candidate.id}`,
      );
    }
    await emitAlert("ORDER_PENDING_REMINDER_PARTIAL", {
      orderId: candidate.id,
      queued: successful.length,
      failed: rejected.length,
    });
  }

  return successful.length;
}

async function runReminderJob(trigger: "http" | "cron") {
  const summary: ReminderSummary = {
    processed: 0,
    queued: 0,
    skippedNoRecipients: 0,
    alreadyNudged: 0,
    errors: 0,
  };

  const now = new Date();
  const thresholdIso = new Date(
    now.getTime() - THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  await logStructuredEvent("ORDER_PENDING_REMINDER_START", {
    trigger,
    thresholdMinutes: THRESHOLD_MINUTES,
    batchSize: BATCH_SIZE,
  });

  try {
    const candidates = await fetchPendingOrders(
      supabase,
      thresholdIso,
      BATCH_SIZE,
    );

    for (const candidate of candidates) {
      summary.processed += 1;

      if (hasVendorNudge(candidate)) {
        summary.alreadyNudged += 1;
        continue;
      }

      const recipients = collectRecipients(candidate);
      if (!recipients.length) {
        summary.skippedNoRecipients += 1;
        await logStructuredEvent("ORDER_PENDING_REMINDER_NO_RECIPIENTS", {
          orderId: candidate.id,
          barId: candidate.bar_id,
        });
        continue;
      }

      const ageMinutes = Math.floor(
        (now.getTime() - new Date(candidate.created_at).getTime()) / 60000,
      );

      try {
        const queuedCount = await queueVendorReminder(
          supabase,
          candidate,
          recipients,
          ageMinutes,
        );
        summary.queued += queuedCount;
        await logStructuredEvent("ORDER_PENDING_REMINDER_QUEUED", {
          orderId: candidate.id,
          queuedCount,
          recipients,
        });
      } catch (error) {
        summary.errors += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error("order-pending-reminder.error", {
          orderId: candidate.id,
          error,
        });
        await emitAlert("ORDER_PENDING_REMINDER_ERROR", {
          orderId: candidate.id,
          message,
        });
      }
    }

    await logStructuredEvent("ORDER_PENDING_REMINDER_DONE", {
      trigger,
      ...summary,
    });
    return summary;
  } catch (error) {
    summary.errors += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error("order-pending-reminder.run_failed", error);
    await emitAlert("ORDER_PENDING_REMINDER_FAILURE", {
      trigger,
      message,
    });
    throw error;
  }
}

serve(async () => {
  try {
    const summary = await runReminderJob("http");
    return json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    return json({ ok: false, error: message }, { status: 500 });
  }
});

if (typeof denoWithCron.cron === "function") {
  if (CRON_ENABLED) {
    denoWithCron.cron("order-pending-reminder", CRON_EXPR, async () => {
      try {
        await runReminderJob("cron");
      } catch (error) {
        console.error("order-pending-reminder.cron_failed", error);
      }
    });
    await logStructuredEvent("ORDER_PENDING_REMINDER_CRON", {
      enabled: true,
      schedule: CRON_EXPR,
    });
  } else {
    await logStructuredEvent("ORDER_PENDING_REMINDER_CRON", {
      enabled: false,
      schedule: CRON_EXPR,
    });
  }
}
