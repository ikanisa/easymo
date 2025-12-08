type FilterOperator = "eq" | "in";

type Filter = {
  column: string;
  operator: FilterOperator;
  value: string | string[];
};

type OrderOption = {
  column: string;
  ascending?: boolean;
};

type SelectOptions = {
  columns: string;
  filters?: Filter[];
  order?: OrderOption;
  limit?: number;
  single?: "single" | "maybe";
};

type MutationOptions = {
  filters?: Filter[];
  returning?: boolean;
  single?: boolean;
};

type RpcOptions = {
  single?: boolean;
};

type RestError = {
  status: number;
  message: string;
  details?: unknown;
  code?: string;
};

function buildFilterParam(filter: Filter): [string, string] {
  if (filter.operator === "eq") {
    return [filter.column, `eq.${filter.value}`];
  }
  if (filter.operator === "in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    const encoded = values
      .map((value) => {
        const needsQuotes = /[(),]/.test(value) || value.includes(" ");
        return needsQuotes ? `\"${value.replace(/\"/g, '\\"')}\"` : value;
      })
      .join(",");
    return [filter.column, `in.(${encoded})`];
  }
  throw new Error(`Unsupported filter operator: ${filter.operator}`);
}

async function parseJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

export class SupabaseRest {
  private readonly restUrl: string;
  private readonly storageUrl: string;
  private readonly functionsUrl: string;
  private readonly headers: HeadersInit;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
  ) {
    this.restUrl = `${baseUrl}/rest/v1`;
    this.storageUrl = `${baseUrl}/storage/v1`;
    this.functionsUrl = `${baseUrl}/functions/v1`;
    this.headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };
  }

  async select<T>(
    table: string,
    options: SelectOptions,
  ): Promise<{ data: T | T[] | null; error: RestError | null }> {
    const url = new URL(`${this.restUrl}/${table}`);
    url.searchParams.set("select", options.columns || "*");
    for (const filter of options.filters ?? []) {
      const [key, value] = buildFilterParam(filter);
      url.searchParams.set(key, value);
    }
    if (options.order) {
      const direction = options.order.ascending === false ? "desc" : "asc";
      url.searchParams.set("order", `${options.order.column}.${direction}`);
    }
    if (typeof options.limit === "number") {
      url.searchParams.set("limit", String(options.limit));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    });
    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      return {
        data: null,
        error: {
          status: response.status,
          message: (errorBody && errorBody.message) || response.statusText,
          details: errorBody?.details ?? errorBody,
          code: errorBody?.code,
        },
      };
    }

    const json = await parseJsonSafe(response);
    if (!json) {
      return { data: options.single ? null : [], error: null };
    }

    if (options.single === "single") {
      if (!Array.isArray(json) || json.length === 0) {
        return {
          data: null,
          error: {
            status: 404,
            message: "Row not found",
          },
        };
      }
      return { data: json[0] as T, error: null };
    }
    if (options.single === "maybe") {
      if (!Array.isArray(json) || json.length === 0) {
        return { data: null, error: null };
      }
      return { data: json[0] as T, error: null };
    }
    return { data: json as T[], error: null };
  }

  async insert<T>(
    table: string,
    payload: unknown,
    options: MutationOptions = {},
  ): Promise<{ data: T | T[] | null; error: RestError | null }> {
    const url = new URL(`${this.restUrl}/${table}`);
    const headers: HeadersInit = {
      ...this.headers,
      "Content-Type": "application/json",
      Prefer: options.returning ? "return=representation" : "return=minimal",
    };

    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return await this.handleMutationResponse<T>(response, options);
  }

  async update<T>(
    table: string,
    payload: unknown,
    options: MutationOptions = {},
  ): Promise<{ data: T | T[] | null; error: RestError | null }> {
    const url = new URL(`${this.restUrl}/${table}`);
    for (const filter of options.filters ?? []) {
      const [key, value] = buildFilterParam(filter);
      url.searchParams.set(key, value);
    }

    const headers: HeadersInit = {
      ...this.headers,
      "Content-Type": "application/json",
      Prefer: options.returning ? "return=representation" : "return=minimal",
    };

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });

    return await this.handleMutationResponse<T>(response, options);
  }

  async delete(
    table: string,
    options: { filters?: Filter[] } = {},
  ): Promise<RestError | null> {
    const url = new URL(`${this.restUrl}/${table}`);
    for (const filter of options.filters ?? []) {
      const [key, value] = buildFilterParam(filter);
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        ...this.headers,
        Prefer: "return=minimal",
      },
    });

    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      return {
        status: response.status,
        message: (errorBody && errorBody.message) || response.statusText,
        details: errorBody?.details ?? errorBody,
        code: errorBody?.code,
      };
    }
    return null;
  }

  async rpc<T>(
    functionName: string,
    payload?: unknown,
    options: RpcOptions = {},
  ): Promise<{ data: T | null; error: RestError | null }> {
    const url = `${this.restUrl}/rpc/${functionName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      return {
        data: null,
        error: {
          status: response.status,
          message: (errorBody && errorBody.message) || response.statusText,
          details: errorBody?.details ?? errorBody,
          code: errorBody?.code,
        },
      };
    }

    const json = await parseJsonSafe(response);
    if (options.single) {
      if (Array.isArray(json) && json.length > 0) {
        return { data: json[0] as T, error: null };
      }
      return { data: null, error: null };
    }
    return { data: json as T, error: null };
  }

  async storageDownload(
    bucket: string,
    path: string,
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const objectUrl = `${this.storageUrl}/object/${
      encodeURIComponent(bucket)
    }/${this.encodeStoragePath(path)}`;
    const response = await fetch(objectUrl, {
      method: "GET",
      headers: this.headers,
    });
    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      throw new Error(
        `Storage download failed (${response.status}): ${
          JSON.stringify(errorBody)
        }`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ??
      "application/octet-stream";
    return { bytes: new Uint8Array(arrayBuffer), contentType };
  }

  async storageUpload(
    bucket: string,
    path: string,
    body: Uint8Array | string,
    options: { contentType?: string; upsert?: boolean } = {},
  ): Promise<void> {
    const objectUrl = `${this.storageUrl}/object/${
      encodeURIComponent(bucket)
    }/${this.encodeStoragePath(path)}`;
    const headers: HeadersInit = {
      ...this.headers,
      "x-upsert": options.upsert ? "true" : "false",
    };
    if (typeof body === "string") {
      headers["Content-Type"] = options.contentType ?? "text/plain";
    } else if (options.contentType) {
      headers["Content-Type"] = options.contentType;
    }

    const response = await fetch(objectUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      throw new Error(
        `Storage upload failed (${response.status}): ${
          JSON.stringify(errorBody)
        }`,
      );
    }
  }

  private async handleMutationResponse<T>(
    response: Response,
    options: MutationOptions,
  ): Promise<{ data: T | T[] | null; error: RestError | null }> {
    if (!response.ok) {
      const errorBody = await parseJsonSafe(response);
      return {
        data: null,
        error: {
          status: response.status,
          message: (errorBody && errorBody.message) || response.statusText,
          details: errorBody?.details ?? errorBody,
          code: errorBody?.code,
        },
      };
    }

    if (!options.returning) {
      return { data: null, error: null };
    }

    const json = await parseJsonSafe(response);
    if (!json) {
      return { data: null, error: null };
    }
    if (options.single) {
      if (Array.isArray(json)) {
        return { data: (json[0] ?? null) as T | null, error: null };
      }
      return { data: json as T, error: null };
    }
    return { data: json as T[], error: null };
  }

  encodeStoragePath(path: string): string {
    return path.split("/").map((part) => encodeURIComponent(part)).join("/");
  }

  buildSupabaseHeaders(): Headers {
    return new Headers(this.headers);
  }
}

export type { RestError };
