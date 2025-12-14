import { logStructuredEvent } from "../../observability/index.ts";

const encoder = new TextEncoder();

async function hmacHex(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(input),
  );
  return Array.from(new Uint8Array(signature)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function normalizeTableLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function makeQrPayload(
  barSlug: string,
  tableLabel: string,
  salt: string,
): Promise<string> {
  const normalizedTable = normalizeTableLabel(tableLabel);
  const body = `B:${barSlug}|T:${normalizedTable}`;
  const signature = await hmacHex(salt, body);
  return `B:${barSlug} T:${normalizedTable} K:${signature}`;
}

export async function verifyQrPayload(
  token: string,
  salts: string | string[],
): Promise<{ barSlug: string; tableLabel: string }> {
  const list = Array.isArray(salts) ? salts : [salts];
  const candidates = list
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length));

  if (!candidates.length) {
    throw new Error("QR token secret not configured");
  }

  const match = token.trim().match(
    /^B:(?<slug>[A-Za-z0-9_-]+)\s+T:(?<table>[A-Za-z0-9\s_-]+)\s+K:(?<sig>[A-Fa-f0-9]{32,})$/,
  );
  if (!match || !match.groups) {
    throw new Error("Invalid token format");
  }
  const slug = match.groups.slug;
  const table = normalizeTableLabel(match.groups.table);
  const expectedSig = match.groups.sig.toLowerCase();

  for (const salt of candidates) {
    const expected = await hmacHex(salt, `B:${slug}|T:${table}`);
    if (expected === expectedSig) {
      return { barSlug: slug, tableLabel: table };
    }
  }

  await logStructuredEvent("QR_TOKEN_FAIL", {
    slug,
    table,
    candidate_count: candidates.length,
  });
  throw new Error("Invalid signature");
}
