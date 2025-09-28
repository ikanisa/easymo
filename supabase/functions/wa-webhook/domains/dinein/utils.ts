import type { RouterContext } from "../../types.ts";
import { logStructuredEvent } from "../../observe/log.ts";

const NUMBER_FORMATTERS: Record<string, Intl.NumberFormat> = {};

function getFormatter(currency: string): Intl.NumberFormat {
  if (!NUMBER_FORMATTERS[currency]) {
    NUMBER_FORMATTERS[currency] = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 0,
    });
  }
  return NUMBER_FORMATTERS[currency];
}

export function formatPrice(minor: number, currency = "RWF"): string {
  return getFormatter(currency).format(minor / 100);
}

export function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export type SliceResult<T> = {
  items: T[];
  nextOffset: number | null;
  prevOffset: number | null;
};

export function slice10<T>(rows: T[], offset: number): SliceResult<T> {
  const start = Math.max(offset, 0);
  const page = rows.slice(start, start + 10);
  const next = start + 10 < rows.length ? start + 10 : null;
  const prev = start > 0 ? Math.max(start - 10, 0) : null;
  return { items: page, nextOffset: next, prevOffset: prev };
}

export function buildLocationLabel(
  parts: Array<string | null | undefined>,
): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(" · ");
}

export function safeInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function clampOffset(length: number, offset: number, step = 10): number {
  if (length <= 0) return 0;
  const normalizedStep = step > 0 ? step : 10;
  if (offset < 0) return 0;
  if (offset >= length) {
    const remainder = length % normalizedStep;
    const floored = remainder === 0
      ? length - normalizedStep
      : length - remainder;
    return Math.max(floored, 0);
  }
  return offset;
}

export function maskWa(value: string): string {
  const trimmed = value.trim();
  const suffix = trimmed.slice(-4);
  return `***${suffix}`;
}

export async function logFlowAction(
  ctx: RouterContext,
  action: string,
  stateKey: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await logStructuredEvent("DINE_FLOW", {
      action,
      state: stateKey,
      wa_id: maskWa(ctx.from),
      ...extra,
    });
  } catch (_err) {
    // logging failures should not break the flow
  }
}
