import { serve } from "../wa-webhook/deps.ts";
import { json } from "shared/http.ts";
import type { SupabaseClient } from "../wa-webhook/deps.ts";
import { supabase } from "../wa-webhook/config.ts";
import {
  queueNotification,
  TEMPLATE_CART_REMINDER,
} from "../wa-webhook/notify/sender.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";
import { emitAlert } from "../wa-webhook/observe/alert.ts";

const DEFAULT_THRESHOLD_MINUTES = 20;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LANGUAGE = Deno.env.get("CART_REMINDER_LANGUAGE") ?? "en";
const CRON_EXPR = Deno.env.get("CART_REMINDER_CRON") ?? "*/10 * * * *";
const CRON_ENABLED = (Deno.env.get("CART_REMINDER_CRON_ENABLED") ?? "")
  .toLowerCase() === "true";

const runtimeFlags = globalThis as {
  __DISABLE_CART_REMINDER_SERVER__?: boolean;
};
const DISABLE_SERVER = runtimeFlags.__DISABLE_CART_REMINDER_SERVER__ === true;

const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};

export function parseIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const THRESHOLD_MINUTES = parseIntEnv(
  "CART_REMINDER_MINUTES",
  DEFAULT_THRESHOLD_MINUTES,
);
const BATCH_SIZE = parseIntEnv("CART_REMINDER_BATCH_SIZE", DEFAULT_BATCH_SIZE);

export interface CartCandidate {
  id: string;
  bar_id: string;
  bar?: {
    name?: string | null;
  } | null;
  expires_at?: string | null;
  created_at: string;
  status: string;
  customer?: {
    profiles?: {
      whatsapp_e164?: string | null;
      display_name?: string | null;
    } | null;
  } | null;
}

type ReminderSummary = {
  processed: number;
  queued: number;
  skippedNoRecipient: number;
  skippedExpired: number;
  skippedQuietHours: number;
  errors: number;
};

export function normalizeWhatsApp(msisdn?: string | null): string | null {
  if (!msisdn) return null;
  const trimmed = msisdn.trim();
  if (!trimmed.length) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

type QuietHours = { start: string; end: string };

function parseQuietHours(value: unknown): QuietHours {
  if (
    value && typeof value === "object" && "start" in value && "end" in value
  ) {
    const record = value as { start?: string; end?: string };
    if (record.start && record.end) {
      return { start: record.start, end: record.end };
    }
  }
  return { start: "22:00", end: "06:00" };
}

async function fetchQuietHours(client: SupabaseClient): Promise<QuietHours> {
  const { data, error } = await client
    .from("settings")
    .select("key, value")
    .eq("key", "quiet_hours.rw")
    .maybeSingle();

  if (error || !data) return { start: "22:00", end: "06:00" };
  return parseQuietHours(data.value ?? null);
}

export function isWithinQuietHours(config: QuietHours, now: Date): boolean {
  const [startH, startM] = config.start.split(":").map(Number);
  const [endH, endM] = config.end.split(":").map(Number);
  if (
    !Number.isFinite(startH) || !Number.isFinite(startM) ||
    !Number.isFinite(endH) || !Number.isFinite(endM)
  ) {
    return false;
  }
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

async function fetchCarts(
  client: SupabaseClient,
  thresholdIso: string,
  limit: number,
): Promise<CartCandidate[]> {
  const { data, error } = await client
    .from("carts")
    .select(
      `id, bar_id, bar:bar_id(name), created_at, status, expires_at,
       customer:customer_id ( profiles:user_id ( whatsapp_e164, display_name ) )
      `,
    )
    .eq("status", "open")
    .lte("created_at", thresholdIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CartCandidate[];
}

async function queueCartReminder(
  client: SupabaseClient,
  cart: CartCandidate,
  recipient: string,
  ageMinutes: number,
): Promise<string> {
  const barName = cart.bar?.name ?? "";
  const result = await queueNotification({
    to: recipient,
    template: {
      name: TEMPLATE_CART_REMINDER,
      language: DEFAULT_LANGUAGE,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: barName },
            { type: "text", text: String(ageMinutes) },
          ],
        },
      ],
    },
  }, {
    type: "cart_reminder",
    cartId: cart.id,
    barId: cart.bar_id,
    barName,
    ageMinutes,
    source: "cart_reminder",
  });

  return result.id;
}

function isExpired(cart: CartCandidate, now: Date): boolean {
  if (!cart.expires_at) return false;
  return new Date(cart.expires_at).getTime() <= now.getTime();
}

async function runCartReminder(trigger: "http" | "cron") {
  const summary: ReminderSummary = {
    processed: 0,
    queued: 0,
    skippedNoRecipient: 0,
    skippedExpired: 0,
    skippedQuietHours: 0,
    errors: 0,
  };

  const now = new Date();
  const thresholdIso = new Date(now.getTime() - THRESHOLD_MINUTES * 60 * 1000)
    .toISOString();

  await logStructuredEvent("CART_REMINDER_START", {
    trigger,
    thresholdMinutes: THRESHOLD_MINUTES,
    batchSize: BATCH_SIZE,
  });

  try {
    const quietHours = await fetchQuietHours(supabase);
    if (isWithinQuietHours(quietHours, now)) {
      summary.skippedQuietHours = BATCH_SIZE;
      await logStructuredEvent("CART_REMINDER_QUIET_HOURS", {
        trigger,
        quietHours,
      });
      return summary;
    }

    const carts = await fetchCarts(supabase, thresholdIso, BATCH_SIZE);

    for (const cart of carts) {
      summary.processed += 1;

      if (isExpired(cart, now)) {
        summary.skippedExpired += 1;
        continue;
      }

      const wa = normalizeWhatsApp(
        cart.customer?.profiles?.whatsapp_e164 ?? null,
      );
      if (!wa) {
        summary.skippedNoRecipient += 1;
        await logStructuredEvent("CART_REMINDER_NO_RECIPIENT", {
          cartId: cart.id,
        });
        continue;
      }

      const ageMinutes = Math.floor(
        (now.getTime() - new Date(cart.created_at).getTime()) / 60000,
      );

      try {
        await queueCartReminder(supabase, cart, wa, ageMinutes);
        summary.queued += 1;
        await logStructuredEvent("CART_REMINDER_QUEUED", {
          cartId: cart.id,
          recipient: wa,
        });
      } catch (error) {
        summary.errors += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error("cart-reminder.queue_failed", { cartId: cart.id, error });
        await emitAlert("CART_REMINDER_ERROR", {
          cartId: cart.id,
          message,
        });
      }
    }

    await logStructuredEvent("CART_REMINDER_DONE", { trigger, ...summary });
    return summary;
  } catch (error) {
    summary.errors += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error("cart-reminder.run_failed", error);
    await emitAlert("CART_REMINDER_FAILURE", { trigger, message });
    throw error;
  }
}

if (!DISABLE_SERVER) {
  serve(async () => {
    try {
      const summary = await runCartReminder("http");
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
      denoWithCron.cron("cart-reminder", CRON_EXPR, async () => {
        try {
          await runCartReminder("cron");
        } catch (error) {
          console.error("cart-reminder.cron_failed", error);
        }
      });
      await logStructuredEvent("CART_REMINDER_CRON", {
        enabled: true,
        schedule: CRON_EXPR,
      });
    } else {
      await logStructuredEvent("CART_REMINDER_CRON", {
        enabled: false,
        schedule: CRON_EXPR,
      });
    }
  }
}
