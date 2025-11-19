import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { getRequestId } from "@easymo/commons";
import type { Response } from "undici";
import type {
  CreateListingRequest,
  CreateListingResponse,
  CreateMatchRequest,
  CreateMatchResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  RecordPaymentRequest,
  RecordPaymentResponse,
  SearchSupabaseRequest,
  SearchSupabaseResponse,
  ToolAttribution,
} from "./types.js";

type SupabaseToolOperation =
  | "searchSupabase"
  | "createListing"
  | "createOrder"
  | "createMatch"
  | "recordPayment";

const DEFAULT_FUNCTIONS: Record<SupabaseToolOperation, string> = {
  searchSupabase: "tool-search-supabase",
  createListing: "tool-create-listing",
  createOrder: "tool-create-order",
  createMatch: "tool-create-match",
  recordPayment: "tool-record-payment",
};

@Injectable()
export class SupabaseToolService {
  private readonly logger = new Logger(SupabaseToolService.name);
  private readonly baseUrl: string | null;
  private readonly serviceKey: string | null;
  private readonly functions: Record<SupabaseToolOperation, string>;

  constructor(private readonly config: ConfigService) {
    const supabaseConfig = this.config.get<{
      url?: string;
      serviceRoleKey?: string;
      functionsUrl?: string;
      tools?: Partial<Record<SupabaseToolOperation, string>>;
    }>("supabase");

    this.serviceKey = supabaseConfig?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
    const configuredBase = supabaseConfig?.functionsUrl ?? process.env.SUPABASE_FUNCTIONS_URL ?? null;
    const projectUrl = supabaseConfig?.url ?? process.env.SUPABASE_URL ?? null;
    this.baseUrl = this.normaliseBaseUrl(configuredBase, projectUrl);
    this.functions = {
      ...DEFAULT_FUNCTIONS,
      ...(supabaseConfig?.tools ?? {}),
    } as Record<SupabaseToolOperation, string>;
  }

  async searchSupabase(payload: SearchSupabaseRequest): Promise<SearchSupabaseResponse> {
    return await this.invoke<SearchSupabaseResponse>("searchSupabase", payload);
  }

  async createListing(payload: CreateListingRequest): Promise<CreateListingResponse> {
    return await this.invoke<CreateListingResponse>("createListing", payload);
  }

  async createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
    return await this.invoke<CreateOrderResponse>("createOrder", payload);
  }

  async createMatch(payload: CreateMatchRequest): Promise<CreateMatchResponse> {
    return await this.invoke<CreateMatchResponse>("createMatch", payload);
  }

  async recordPayment(payload: RecordPaymentRequest): Promise<RecordPaymentResponse> {
    return await this.invoke<RecordPaymentResponse>("recordPayment", payload);
  }

  private normaliseBaseUrl(functionsUrl: string | null, projectUrl: string | null): string | null {
    if (functionsUrl && functionsUrl.trim().length > 0) {
      return functionsUrl.replace(/\/+$/, "");
    }
    if (projectUrl && projectUrl.trim().length > 0) {
      return `${projectUrl.replace(/\/+$/, "")}/functions/v1`;
    }
    return null;
  }

  private async invoke<T>(operation: SupabaseToolOperation, payload: unknown): Promise<T> {
    const functionName = this.functions[operation];
    if (!functionName) {
      throw new ServiceUnavailableException(`No edge function configured for ${operation}`);
    }
    if (!this.baseUrl || !this.serviceKey) {
      throw new ServiceUnavailableException("Supabase Edge Functions are not configured");
    }

    const requestId = getRequestId() ?? randomUUID();
    const url = `${this.baseUrl}/${functionName}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      "X-Agent-Core": "tools",
      "X-Agent-Tool": operation,
      "X-Request-ID": requestId,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      this.logger.error("tools.supabase.network_error", {
        operation,
        url,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new BadGatewayException("Supabase edge function unavailable");
    }

    const parsed = await this.parseResponse(response);
    if (!response.ok) {
      this.logger.warn("tools.supabase.invoke_failed", {
        operation,
        status: response.status,
        body: parsed,
      });
      throw new BadGatewayException("Supabase edge function call failed");
    }
    return (parsed ?? ({} as T)) as T;
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

export const buildTenantScopedPayload = <T extends { tenantId: string; attribution?: Partial<ToolAttribution> }>(
  payload: T,
  attribution: ToolAttribution,
): Omit<T, "tenantId" | "attribution"> & { tenant_id: string; attribution: ToolAttribution } => {
  const { tenantId, attribution: _ignored, ...rest } = payload;
  return {
    ...(rest as Omit<T, "tenantId" | "attribution">),
    tenant_id: tenantId,
    attribution,
  };
};
