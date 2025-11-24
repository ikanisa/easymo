import { TextEncoder } from "./wa-webhook-shared/deps.ts";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

const RAW_SERVICE_ACCOUNT = Deno.env.get("BQ_SERVICE_ACCOUNT_JSON") ??
  Deno.env.get("BQ_SERVICE_ACCOUNT");

if (!RAW_SERVICE_ACCOUNT) {
  console.warn("BQ_SERVICE_ACCOUNT_JSON not configured. BigQuery streaming disabled.");
}

const SERVICE_ACCOUNT: ServiceAccount | null = RAW_SERVICE_ACCOUNT
  ? JSON.parse(RAW_SERVICE_ACCOUNT)
  : null;

const DEFAULT_PROJECT_ID = Deno.env.get("BQ_PROJECT_ID") ?? SERVICE_ACCOUNT?.project_id ?? "";

let cachedToken: { value: string; expires: number } | null = null;

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pemToCryptoKey(privateKeyPem: string): Promise<CryptoKey> {
  const pem = privateKeyPem.replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)).buffer;
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createJwt(assertionOptions: {
  email: string;
  privateKey: string;
  scope: string;
}): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
  })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({
      iss: assertionOptions.email,
      scope: assertionOptions.scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })),
  );
  const signingInput = `${header}.${payload}`;
  const key = await pemToCryptoKey(assertionOptions.privateKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function fetchAccessToken(): Promise<string | null> {
  if (!SERVICE_ACCOUNT) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 60000) {
    return cachedToken.value;
  }

  const assertion = await createJwt({
    email: SERVICE_ACCOUNT.client_email,
    privateKey: SERVICE_ACCOUNT.private_key,
    scope: "https://www.googleapis.com/auth/bigquery.insertdata",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error("bigquery.auth_failed", json);
    return null;
  }

  cachedToken = {
    value: json.access_token as string,
    expires: Date.now() + (Number(json.expires_in ?? 3600) * 1000),
  };
  return cachedToken.value;
}

export type BigQueryRow = {
  insertId?: string;
  json: Record<string, unknown>;
};

export type BigQueryInsertResult = {
  success: boolean;
  error?: string;
  insertErrors?: unknown;
};

export async function streamRowsToBigQuery(
  rows: BigQueryRow[],
  options: {
    projectId?: string;
    dataset: string;
    table: string;
  },
): Promise<BigQueryInsertResult> {
  if (!rows.length) return { success: true };
  if (!SERVICE_ACCOUNT) {
    return { success: false, error: "service_account_missing" };
  }
  const token = await fetchAccessToken();
  if (!token) {
    return { success: false, error: "token_unavailable" };
  }

  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  if (!projectId) {
    return { success: false, error: "project_id_missing" };
  }

  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${options.dataset}/tables/${options.table}/insertAll`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "bigquery#tableDataInsertAllRequest",
        skipInvalidRows: true,
        ignoreUnknownValues: true,
        rows,
      }),
    },
  );

  const json = await response.json();
  if (!response.ok) {
    return {
      success: false,
      error: json?.error?.message ?? "bq_insert_failed",
      insertErrors: json,
    };
  }

  if (Array.isArray(json.insertErrors) && json.insertErrors.length > 0) {
    return {
      success: false,
      error: "insertErrors",
      insertErrors: json.insertErrors,
    };
  }

  return { success: true };
}
