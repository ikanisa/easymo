import { supabase } from "../config.ts";

type LogMeta = Record<string, unknown> & {
  headers?: Record<string, unknown>;
  statusCode?: number;
  status_code?: number;
  errorMessage?: string;
  error_message?: string;
};

async function insertLog(
  endpoint: string,
  payload: unknown,
  meta: LogMeta = {},
): Promise<void> {
  try {
    const { headers, statusCode, status_code, errorMessage, error_message, ...rest } = meta;
    const finalHeaders = headers ?? rest;
    await supabase.from("webhook_logs").insert({
      endpoint,
      payload,
      headers: finalHeaders,
      status_code: typeof statusCode === "number"
        ? statusCode
        : typeof status_code === "number"
        ? status_code
        : null,
      error_message: typeof errorMessage === "string"
        ? errorMessage
        : typeof error_message === "string"
        ? error_message
        : null,
    });
  } catch (err) {
    console.error("wa_webhook.log_insert_fail", endpoint, err);
  }
}

export async function logInbound(payload: unknown): Promise<void> {
  await insertLog("wa_inbound", payload);
}

export async function logEvent(
  scope: string,
  payload: unknown,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await insertLog(scope, payload, extra);
}

export async function logMobilityMatch(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("MOBILITY_MATCH", payload);
}

export async function logOcrStatus(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("OCR_STATUS", payload);
}

export async function logWalletAdjust(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("WALLET_ADJUST", payload);
}

export async function logAdminAction(
  payload: Record<string, unknown>,
): Promise<void> {
  await insertLog("ADMIN_ACTION", payload);
}

export function logError(
  scope: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
  console.error(scope, error, extra);
}
