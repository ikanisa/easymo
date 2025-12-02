import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const textEncoder = new TextEncoder();

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
  throw new Error("Base64 encoding is not supported in this environment.");
}

function pemToUint8Array(pem: string): Uint8Array {
  const normalized = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (typeof atob === "function") {
    const binary = atob(normalized);
    const output = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      output[i] = binary.charCodeAt(i);
    }
    return output;
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }
  throw new Error("Base64 decoding is not supported in this environment.");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyBytes = pemToUint8Array(pem);
  // Cast to ArrayBuffer to satisfy BufferSource types across DOM libs
  const ab = keyBytes.buffer as unknown as ArrayBuffer;
  return crypto.subtle.importKey(
    "pkcs8",
    ab,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createServiceAccountAssertion(
  header: Record<string, unknown>,
  claim: Record<string, unknown>,
  privateKey: string,
): Promise<string | null> {
  try {
    const headerSegment = base64UrlEncodeBytes(
      textEncoder.encode(JSON.stringify(header)),
    );
    const claimSegment = base64UrlEncodeBytes(
      textEncoder.encode(JSON.stringify(claim)),
    );
    const toSign = `${headerSegment}.${claimSegment}`;
    const key = await importPrivateKey(privateKey);
    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      textEncoder.encode(toSign),
    );
    const signature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
    return `${toSign}.${signature}`;
  } catch {
    return null;
  }
}

function parseFolderId(input: string): string | null {
  try {
    // Accept raw ID or drive folder URL
    if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
    const m = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

async function getServiceAccountToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_DRIVE_SA_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, "\n");
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const assertion = await createServiceAccountAssertion(header, claim, privateKey);
  if (!assertion) return null;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.access_token || null;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const saToken = await getServiceAccountToken();
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const obj = (body && typeof body === 'object' ? body as Record<string, unknown> : {});
  const folder = String(obj?.folder ?? '').trim();
  const folderId = parseFolderId(folder);
  if (!folderId) return NextResponse.json({ error: 'invalid_folder' }, { status: 400 });
  const pageSize = Math.min(Number((obj as Record<string, unknown>)?.page_size ?? 100), 1000);
  const maxPerHour = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_HOUR || '0') || 0;
  const maxPerDay = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_DAY || '0') || 0;
  const maxPerRequest = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_REQUEST || '0') || 0;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'`);
  url.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,webContentLink)');
  url.searchParams.set('pageSize', String(pageSize));
  if (apiKey) url.searchParams.set('key', apiKey);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), saToken ? { headers: { Authorization: `Bearer ${saToken}` } } : undefined);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  if (!resp.ok) return NextResponse.json({ error: `drive_list_failed:${resp.status}` }, { status: 502 });
  const json: unknown = await resp.json();
  type DriveFile = { id?: string; name?: string; mimeType?: string; webViewLink?: string; webContentLink?: string };
  const files: DriveFile[] = (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).files))
    ? ((json as Record<string, unknown>).files as DriveFile[])
    : [];
  if (maxPerHour > 0) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    const remaining = Math.max(0, maxPerHour - (count ?? 0));
    if (remaining <= 0) return NextResponse.json({ error: 'rate_limited', limit: maxPerHour }, { status: 429 });
    if (files.length > remaining) files.length = remaining;
  }
  if (maxPerDay > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    const dailyRemaining = Math.max(0, maxPerDay - (count ?? 0));
    if (dailyRemaining <= 0) return NextResponse.json({ error: 'rate_limited_daily', limit: maxPerDay }, { status: 429 });
    if (files.length > dailyRemaining) files.length = dailyRemaining;
  }
  if (maxPerRequest > 0 && files.length > maxPerRequest) files.length = maxPerRequest;
  if (!files.length) return NextResponse.json({ imported: 0, reason: 'no_files' }, { status: 200 });
  const urlsAll: string[] = files.map((f) => {
    const directUrl = typeof f?.webViewLink === "string" ? f.webViewLink : null;
    return directUrl ?? `https://drive.google.com/file/d/${f?.id ?? ''}/view`;
  });
  const uniqueUrlsAll = Array.from(new Set<string>(urlsAll));
  const duplicatesBatch = urlsAll.length - uniqueUrlsAll.length;
  const { data: existingRows } = await admin.from('agent_documents').select('source_url').eq('agent_id', id).in('source_url', uniqueUrlsAll);
  const existingSet = new Set<string>((existingRows ?? []).map((r: { source_url: string }) => r.source_url));
  const newUrls: string[] = uniqueUrlsAll.filter((u) => !existingSet.has(u));

  const mapByUrl = new Map<string, DriveFile>();
  files.forEach((f) => {
    const url = f?.webViewLink || `https://drive.google.com/file/d/${f?.id ?? ''}/view`;
    mapByUrl.set(url, f);
  });
  const rows = newUrls.map((u) => {
    const f = mapByUrl.get(u);
    return {
      agent_id: id,
      title: String(f?.name || u),
      source_url: u,
      embedding_status: 'pending' as const,
      metadata: { mimeType: f?.mimeType || null, driveId: f?.id }
    };
  });
  const { data, error } = await admin
    .from('agent_documents')
    .upsert(rows, { onConflict: 'agent_id,source_url' })
    .select('id');
  if (error) return NextResponse.json({ error }, { status: 400 });
  const imported = data?.length ?? 0;
  const duplicatesDb = existingSet.size;
  return NextResponse.json({ imported, duplicates: duplicatesBatch + duplicatesDb });
}

export const runtime = "nodejs";
