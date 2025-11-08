// Note: Server-side module for edge bridges
import { z } from "zod";
import { logStructured } from "@/lib/server/logger";

type BridgeTarget =
  | "voucherPreview"
  | "voucherGenerate"
  | "voucherSend"
  | "campaignDispatch"
  | "insuranceWorkflow"
  | "stationDirectory";

type BridgeMethod = "POST" | "GET";

type BridgeFailureReason = "missing_endpoint" | "network_error" | "http_error";

export interface BridgeSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface BridgeFailure {
  ok: false;
  status?: number;
  reason: BridgeFailureReason;
  message: string;
}

export type BridgeResult<T> = BridgeSuccess<T> | BridgeFailure;

interface BridgeConfig {
  method: BridgeMethod;
  envKeys: readonly string[];
  defaultMessage: string;
  timeoutMs?: number;
}

const TARGET_CONFIG: Record<BridgeTarget, BridgeConfig> = {
  voucherPreview: {
    method: "POST",
    envKeys: [
      "VOUCHER_PREVIEW_ENDPOINT",
      "NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT",
    ],
    defaultMessage:
      "Voucher preview service not configured. Set VOUCHER_PREVIEW_ENDPOINT to enable previews.",
  },
  voucherGenerate: {
    method: "POST",
    envKeys: ["VOUCHER_GENERATE_ENDPOINT"],
    defaultMessage:
      "Voucher issuance bridge unavailable. Configure VOUCHER_GENERATE_ENDPOINT to enable real issuance.",
  },
  voucherSend: {
    method: "POST",
    envKeys: ["VOUCHER_SEND_ENDPOINT", "NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT"],
    defaultMessage:
      "Voucher send bridge unavailable. Configure VOUCHER_SEND_ENDPOINT to dispatch WhatsApp messages.",
  },
  campaignDispatch: {
    method: "POST",
    envKeys: [
      "CAMPAIGN_DISPATCHER_ENDPOINT",
      "NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT",
    ],
    defaultMessage:
      "Campaign dispatcher bridge unavailable. Configure CAMPAIGN_DISPATCHER_ENDPOINT to control campaign state.",
  },
  insuranceWorkflow: {
    method: "POST",
    envKeys: ["INSURANCE_WORKFLOW_ENDPOINT"],
    defaultMessage:
      "Insurance workflow bridge unavailable. Configure INSURANCE_WORKFLOW_ENDPOINT to sync quote decisions.",
  },
  stationDirectory: {
    method: "POST",
    envKeys: ["STATION_DIRECTORY_ENDPOINT"],
    defaultMessage:
      "Station directory bridge unavailable. Configure STATION_DIRECTORY_ENDPOINT to propagate station updates.",
  },
};

interface BridgeOptions {
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const jsonContentType = /application\/json/i;

function resolveEndpoint(envKeys: readonly string[]): string | null {
  for (const key of envKeys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  return null;
}

function buildDefaultHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRole) {
    headers.Authorization = `Bearer ${serviceRole}`;
  }

  const sharedSecret = process.env.BRIDGE_SHARED_SECRET;
  if (sharedSecret) {
    headers["x-bridge-secret"] = sharedSecret;
  }

  return headers;
}

const errorSchema = z
  .object({
    message: z.string().optional(),
  })
  .passthrough();

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) {
    return {} as T;
  }
  if (!jsonContentType.test(response.headers.get("content-type") ?? "")) {
    return raw as unknown as T;
  }
  return JSON.parse(raw) as T;
}

export async function callBridge<T>(
  target: BridgeTarget,
  payload: unknown,
  options: BridgeOptions = {},
): Promise<BridgeResult<T>> {
  const config = TARGET_CONFIG[target];
  const endpoint = resolveEndpoint(config.envKeys);

  if (!endpoint) {
    logStructured({
      event: "bridge_missing_endpoint",
      target,
      status: "degraded",
      message: config.defaultMessage,
    });
    return {
      ok: false,
      reason: "missing_endpoint",
      message: config.defaultMessage,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? 5000,
  );

  try {
    const headers = {
      ...buildDefaultHeaders(),
      ...(options.headers ?? {}),
    };

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await fetch(endpoint, {
      method: config.method,
      headers,
      body: config.method === "POST" ? JSON.stringify(payload) : undefined,
      signal: options.signal ?? controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let message = config.defaultMessage;
      try {
        const parsed = errorSchema.parse(
          await parseJsonResponse<unknown>(response),
        );
        if (parsed.message) {
          message = parsed.message;
        }
      } catch (error) {
        console.error(`Bridge ${target} error payload parse failed`, error);
      }
      logStructured({
        event: "bridge_http_error",
        target,
        status: "degraded",
        message,
        details: { status: response.status },
      });
      return {
        ok: false,
        status: response.status,
        reason: "http_error",
        message,
      };
    }

    const data = await parseJsonResponse<T>(response);
    logStructured({
      event: "bridge_success",
      target,
      status: "ok",
    });
    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    logStructured({
      event: "bridge_network_error",
      target,
      status: "degraded",
      message: error instanceof Error ? error.message : config.defaultMessage,
    });
    clearTimeout(timeout);
    return {
      ok: false,
      reason: "network_error",
      message: error instanceof Error ? error.message : config.defaultMessage,
    };
  }
}

export function bridgeDegraded(target: BridgeTarget, failure: BridgeFailure): {
  target: BridgeTarget;
  status: "degraded";
  reason: BridgeFailureReason;
  message: string;
} {
  return {
    target,
    status: "degraded",
    reason: failure.reason,
    message: failure.message,
  };
}

export function bridgeHealthy(target: BridgeTarget): {
  target: BridgeTarget;
  status: "ok";
} {
  return {
    target,
    status: "ok",
  };
}
