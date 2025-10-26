import {
  getAdminApiRoutePath,
  type AdminApiRouteKey,
  type AdminApiRouteParams,
} from "@/lib/routes";

type PrimitiveQueryValue = string | number | boolean | undefined | null;

export interface AdminApiRequestOptions<Key extends AdminApiRouteKey> {
  params?: AdminApiRouteParams<Key>;
  query?: Record<string, PrimitiveQueryValue>;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown> | Array<unknown>;
  signal?: AbortSignal;
  parser?: <T>(response: Response) => Promise<T>;
}

export interface AdminApiClientOptions {
  baseInit?: RequestInit;
  onError?: (error: AdminApiError, response: Response | null) => void;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string | null;
  readonly details?: unknown;

  constructor(message: string, options: { status: number; code?: string; requestId?: string | null; details?: unknown }) {
    super(message);
    this.name = "AdminApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export class AdminApiClient {
  private readonly baseInit: RequestInit;
  private readonly onError?: (error: AdminApiError, response: Response | null) => void;

  constructor(options: AdminApiClientOptions = {}) {
    this.baseInit = options.baseInit ?? {};
    this.onError = options.onError;
  }

  async request<T = unknown, Key extends AdminApiRouteKey = AdminApiRouteKey>(
    key: Key,
    options: AdminApiRequestOptions<Key> = {},
  ): Promise<T> {
    const url = this.buildUrl(key, options.params, options.query);
    const init = await this.buildRequestInit(options);

    let response: Response | null = null;
    try {
      response = await fetch(url, init);
      if (!response.ok) {
        throw await this.toError(response);
      }
      return options.parser ? options.parser<T>(response) : this.parseJson<T>(response);
    } catch (error) {
      if (error instanceof AdminApiError) {
        this.onError?.(error, response);
        throw error;
      }

      const fallback = new AdminApiError(
        error instanceof Error ? error.message : "Unknown admin API error",
        { status: response?.status ?? 0, details: response },
      );
      this.onError?.(fallback, response);
      throw fallback;
    }
  }

  private buildUrl<Key extends AdminApiRouteKey>(
    key: Key,
    params: AdminApiRouteParams<Key> | undefined,
    query: Record<string, PrimitiveQueryValue> | undefined,
  ) {
    const path = params ? getAdminApiRoutePath(key, params) : getAdminApiRoutePath(key);
    if (!query || Object.keys(query).length === 0) {
      return path;
    }

    const qs = new URLSearchParams();
    for (const [rawKey, rawValue] of Object.entries(query)) {
      if (rawValue === undefined || rawValue === null) continue;
      qs.append(rawKey, String(rawValue));
    }

    const suffix = qs.toString();
    return suffix.length > 0 ? `${path}?${suffix}` : path;
  }

  private async buildRequestInit<Key extends AdminApiRouteKey>(
    options: AdminApiRequestOptions<Key>,
  ): Promise<RequestInit> {
    const headers = new Headers(this.baseInit.headers ?? undefined);
    if (options.headers) {
      const provided = new Headers(options.headers);
      provided.forEach((value, key) => headers.set(key, value));
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (this.isBodyInit(options.body)) {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }
    }

    const method = options.method ?? (body ? "POST" : "GET");

    return {
      ...this.baseInit,
      method,
      headers,
      body,
      signal: options.signal,
    };
  }

  private async parseJson<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AdminApiError("Failed to parse JSON response", {
        status: response.status,
        details: { text },
        code: "invalid_json",
      });
    }
  }

  private async toError(response: Response): Promise<AdminApiError> {
    const requestId = response.headers.get("x-request-id");
    const fallbackMessage = response.statusText || "Admin API request failed";
    let payload: any = null;

    try {
      payload = await response.clone().json();
    } catch {
      // Ignore JSON parsing issues; we'll fall back to text.
    }

    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : fallbackMessage;

    const code =
      typeof payload?.code === "string"
        ? payload.code
        : typeof payload?.error === "string"
          ? payload.error
          : undefined;

    return new AdminApiError(message, {
      status: response.status,
      code,
      requestId,
      details: payload ?? undefined,
    });
  }

  private isBodyInit(value: unknown): value is BodyInit {
    if (value == null) return false;
    if (typeof value === "string") return true;
    if (typeof Blob !== "undefined" && value instanceof Blob) return true;
    if (typeof FormData !== "undefined" && value instanceof FormData) return true;
    if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) return true;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
    if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) return true;
    return false;
  }
}

export const apiClient = new AdminApiClient({
  onError: (error) => {
    console.error("admin_api.error", {
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: error.requestId ?? undefined,
    });
  },
});

export const createAdminApiClient = (options?: AdminApiClientOptions) =>
  new AdminApiClient(options);
