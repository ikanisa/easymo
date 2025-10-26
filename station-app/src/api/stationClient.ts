import { z } from "zod";

import type {
  RedeemRequest,
  RedeemResponse,
  StationBalance,
  StationHistoryResponse,
  StationLoginPayload,
  StationSession,
} from "@station/api/types";

const loginResponseSchema = z.object({
  token: z.string(),
  stationId: z.string(),
  operatorName: z.string(),
  stationName: z.string(),
  expiresAt: z.string(),
});

const balanceSchema = z.object({
  available: z.number(),
  pending: z.number(),
  currency: z.string(),
  lastSyncedAt: z.string(),
});

const redeemSuccessSchema = z.object({
  status: z.enum(["redeemed", "already_redeemed"]),
  amount: z.number(),
  currency: z.string(),
  maskedMsisdn: z.string(),
  redeemedAt: z.string(),
  voucherId: z.string(),
  reference: z.string(),
});

const redeemErrorSchema = z.object({
  status: z.enum(["not_found", "invalid_station", "network_error", "replay", "unknown_error"]),
  message: z.string(),
  retryable: z.boolean(),
});

const redeemResponseSchema = z.union([redeemSuccessSchema, redeemErrorSchema]);

const historySchema = z.object({
  items: z
    .array(
      z.object({
        voucherId: z.string(),
        amount: z.number(),
        currency: z.string(),
        maskedMsisdn: z.string(),
        redeemedAt: z.string(),
        status: z.enum(["redeemed", "already_redeemed", "declined"]),
        reference: z.string(),
      }),
    )
    .default([]),
});

type StationClientOptions = {
  baseUrl?: string;
  token: string | null;
  fetchImpl?: typeof fetch;
};

export class StationClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: StationClientOptions) {
    this.baseUrl = options.baseUrl ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  private headers() {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (this.options.token) {
      headers.set("Authorization", `Bearer ${this.options.token}`);
    }
    return headers;
  }

  async login(payload: StationLoginPayload): Promise<StationSession> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/station/login`, {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("station.login_failed");
    }

    const json = await response.json();
    return loginResponseSchema.parse(json);
  }

  async redeem(payload: RedeemRequest, idempotencyKey: string): Promise<RedeemResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/station/redeem`, {
      method: "POST",
      headers: (() => {
        const headers = this.headers();
        headers.set("Idempotency-Key", idempotencyKey);
        return headers;
      })(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error: RedeemResponse = {
        status: response.status === 404 ? "not_found" : "unknown_error",
        message: `Redeem failed with status ${response.status}`,
        retryable: response.status >= 500,
      };
      return error;
    }

    const json = await response.json();
    return redeemResponseSchema.parse(json);
  }

  async balance(): Promise<StationBalance> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/station/balance`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error("station.balance_failed");
    }

    const json = await response.json();
    return balanceSchema.parse(json);
  }

  async history(): Promise<StationHistoryResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/station/history`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error("station.history_failed");
    }

    const json = await response.json();
    return historySchema.parse(json);
  }
}
