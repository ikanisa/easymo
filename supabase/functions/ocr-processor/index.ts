import { IDS } from "../wa-webhook/wa/ids.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const MENU_MEDIA_BUCKET = Deno.env.get("MENU_MEDIA_BUCKET") ??
  "menu-source-files";
const OCR_RESULT_BUCKET = Deno.env.get("OCR_RESULT_BUCKET") ?? "ocr-json-cache";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";
const MAX_JOB_ATTEMPTS = parsePositiveInteger(
  Deno.env.get("OCR_MAX_ATTEMPTS"),
  3,
);
const CLAIM_CANDIDATE_LIMIT = parsePositiveInteger(
  Deno.env.get("OCR_QUEUE_SCAN_LIMIT"),
  5,
);
const MAX_MENU_CATEGORIES = parsePositiveInteger(
  Deno.env.get("OCR_MAX_MENU_CATEGORIES"),
  50,
);
const MAX_MENU_ITEMS = parsePositiveInteger(
  Deno.env.get("OCR_MAX_MENU_ITEMS"),
  500,
);

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

type SupabaseClient = any;

interface OcrJob {
  id: string;
  bar_id: string;
  source_file_id: string;
}

interface UpdateOptions {
  errorMessage?: string | null;
  resultPath?: string | null;
  menuId?: string | null;
}

interface OcrWorkerDeps {
  claimNextJob: () => Promise<OcrJob | null>;
  updateJobStatus: (
    id: string,
    status: JobStatus,
    options?: UpdateOptions,
  ) => Promise<void>;
  downloadSourceFile: (
    path: string,
  ) => Promise<{ base64Data: string; contentType: string }>;
  runOpenAiExtraction: (
    imageBase64: string,
    contentType: string,
  ) => Promise<{ raw: string; data: MenuExtraction }>;
  storeExtractionResult: (jobId: string, raw: string) => Promise<string>;
  upsertMenuFromExtraction: (
    job: OcrJob,
    extraction: MenuExtraction,
  ) => Promise<string>;
  notifyMenuReady: (barId: string) => Promise<void>;
}

const globalFlags = globalThis as { __DISABLE_OCR_SERVER__?: boolean };

let defaultDeps: OcrWorkerDeps | null = null;

const SUPABASE_MODULE = globalFlags.__DISABLE_OCR_SERVER__
  ? "./supabase_client_stub.ts"
  : "https://esm.sh/@supabase/supabase-js@2.45.0";

function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createDefaultDeps(client: SupabaseClient): OcrWorkerDeps {
  return {
    claimNextJob: () => claimNextJob(client),
    updateJobStatus: (id, status, options) =>
      updateJobStatus(client, id, status, options),
    downloadSourceFile: (path) => downloadSourceFile(client, path),
    runOpenAiExtraction: (imageBase64, contentType) =>
      runOpenAiExtraction(imageBase64, contentType),
    storeExtractionResult: (jobId, raw) =>
      storeExtractionResult(client, jobId, raw),
    upsertMenuFromExtraction: (job, extraction) =>
      upsertMenuFromExtraction(client, job, extraction),
    notifyMenuReady: (barId) => sendMenuReadyNotification(client, barId),
  };
}

export async function processNextJob(
  deps?: OcrWorkerDeps,
): Promise<{ status: "no_job" } | { status: "processed"; jobId: string }> {
  const activeDeps = deps ?? defaultDeps;
  if (!activeDeps) {
    throw new Error("OCR worker dependencies not initialised");
  }

  const job = await activeDeps.claimNextJob();
  if (!job) {
    console.log("ocr.job_none_available");
    return { status: "no_job" };
  }

  console.log("ocr.job_start", { jobId: job.id, barId: job.bar_id });
  let menuId: string | null = null;
  try {
    const file = await activeDeps.downloadSourceFile(job.source_file_id);
    const extraction = await activeDeps.runOpenAiExtraction(
      file.base64Data,
      file.contentType,
    );
    const resultPath = await activeDeps.storeExtractionResult(
      job.id,
      extraction.raw,
    );
    menuId = await activeDeps.upsertMenuFromExtraction(job, extraction.data);
    await activeDeps.updateJobStatus(job.id, "succeeded", {
      resultPath,
      menuId,
    });
    console.log("ocr.job_succeeded", { jobId: job.id, resultPath, menuId });
    await activeDeps.notifyMenuReady(job.bar_id);
    return { status: "processed", jobId: job.id };
  } catch (error) {
    await activeDeps.updateJobStatus(job.id, "failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
      menuId,
    });
    console.error("ocr.job_failed", { jobId: job.id, error, menuId });
    throw error;
  }
}

if (!globalFlags.__DISABLE_OCR_SERVER__) {
  const { createClient } = await import(SUPABASE_MODULE) as {
    createClient: (url: string, key: string) => SupabaseClient;
  };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  defaultDeps = createDefaultDeps(supabase);

  Deno.serve(async () => {
    if (!OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    try {
      const result = await processNextJob();
      if (result.status === "no_job") {
        console.log("ocr.process_none_available");
        return new Response("No jobs", { status: 200 });
      }
      console.log("ocr.processed", result);
      return new Response("Job processed", { status: 200 });
    } catch (error) {
      console.error("ocr.job_failed", error);
      return new Response("Job failed", { status: 500 });
    }
  });
}

async function claimNextJob(client: SupabaseClient): Promise<OcrJob | null> {
  const { data: candidates, error } = await client
    .from("ocr_jobs")
    .select("id, bar_id, source_file_id, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(CLAIM_CANDIDATE_LIMIT);
  if (error) throw error;

  const now = new Date().toISOString();
  for (const candidate of candidates ?? []) {
    const attempts = (candidate as { attempts?: number }).attempts ?? 0;
    if (attempts >= MAX_JOB_ATTEMPTS) {
      const { error: failError } = await client
        .from("ocr_jobs")
        .update({
          status: "failed",
          updated_at: now,
          last_attempt_at: now,
          error_message:
            `Exceeded max attempts (${MAX_JOB_ATTEMPTS}) without successful processing`,
        })
        .eq("id", candidate.id)
        .eq("status", "queued");
      if (failError) throw failError;
      continue;
    }

    const { data: updatedRows, error: updateError } = await client
      .from("ocr_jobs")
      .update({
        status: "processing",
        updated_at: now,
        last_attempt_at: now,
        attempts: attempts + 1,
      })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("id, bar_id, source_file_id")
      .limit(1);
    if (updateError) throw updateError;
    if (updatedRows && updatedRows.length > 0) {
      const row = updatedRows[0] as OcrJob;
      return row;
    }
  }
  return null;
}

async function updateJobStatus(
  client: SupabaseClient,
  id: string,
  status: JobStatus,
  options: UpdateOptions = {},
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if ("errorMessage" in options) {
    update.error_message = options.errorMessage ?? null;
  }
  if ("resultPath" in options) update.result_path = options.resultPath ?? null;
  if ("menuId" in options) update.menu_id = options.menuId ?? null;
  const { error } = await client.from("ocr_jobs").update(update).eq("id", id);
  if (error) throw error;
}

async function downloadSourceFile(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from(MENU_MEDIA_BUCKET).download(
    path,
  );
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  const base64Data = bytesToBase64(new Uint8Array(arrayBuffer));
  const contentType = data.type ?? "application/octet-stream";
  return { base64Data, contentType };
}

async function runOpenAiExtraction(imageBase64: string, contentType: string) {
  if (!contentType?.startsWith("image/")) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  const prompt = buildMenuPrompt();
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        {
          role: "user",
          content: [
            { type: "text", text: prompt.user },
            {
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${text}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response lacked content");
  }

  let parsed;
  try {
    const cleaned = stripJsonFence(content);
    parsed = JSON.parse(cleaned);
  } catch (_error) {
    throw new Error("Failed to parse OpenAI JSON response");
  }

  const normalized = normalizeExtractionPayload(parsed);
  return { raw: content, data: normalized };
}

async function storeExtractionResult(
  client: SupabaseClient,
  jobId: string,
  raw: string,
) {
  const path = `results/${jobId}.json`;
  const { error } = await client.storage.from(OCR_RESULT_BUCKET).upload(
    path,
    raw,
    {
      upsert: true,
      contentType: "application/json",
    },
  );
  if (error) throw error;
  return path;
}

async function upsertMenuFromExtraction(
  client: SupabaseClient,
  job: OcrJob,
  extraction: MenuExtraction,
): Promise<string> {
  const barId = job.bar_id;
  const { data: latestVersionRow, error: versionError } = await client
    .from("menus")
    .select("version")
    .eq("bar_id", barId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;

  const nextVersion =
    ((latestVersionRow as { version?: number } | null)?.version ?? 0) + 1;

  const currency = sanitizeCurrency(extraction.currency ?? undefined);
  let menuId: string | null = null;

  try {
    const { data: menu, error: menuError } = await client
      .from("menus")
      .insert({
        bar_id: barId,
        status: "draft",
        version: nextVersion,
        source: "ocr",
        source_file_ids: job.source_file_id ? [job.source_file_id] : [],
      })
      .select("id")
      .single();
    if (menuError) throw menuError;

    menuId = (menu as { id: string }).id;

    let categoryOrder = 0;
    for (const category of extraction.categories ?? []) {
      const { data: categoryRow, error: categoryError } = await client
        .from("categories")
        .insert({
          bar_id: barId,
          menu_id: menuId,
          parent_category_id: null,
          name: category.name,
          sort_order: categoryOrder,
        })
        .select("id")
        .single();
      if (categoryError) throw categoryError;

      const categoryId = (categoryRow as { id: string }).id;
      let itemOrder = 0;
      for (const item of category.items ?? []) {
        const priceMinor = normalizePrice(item.price);
        const flags = Array.isArray(item.flags) ? item.flags : [];
        const { error: itemError } = await client
          .from("items")
          .insert({
            bar_id: barId,
            menu_id: menuId,
            category_id: categoryId,
            name: item.name,
            short_description: item.description ?? null,
            price_minor: priceMinor,
            currency,
            flags,
            is_available: true,
            sort_order: itemOrder,
          });
        if (itemError) throw itemError;
        itemOrder += 1;
      }
      categoryOrder += 1;
    }
    return menuId;
  } catch (error) {
    if (menuId) {
      await cleanupMenuDraft(client, menuId);
    }
    throw error;
  }
}

const VALID_FLAGS = new Set([
  "spicy",
  "hot",
  "gluten_free",
  "veg",
  "vegan",
  "halal",
]);

function sanitizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/[A-Z]{3}/);
  return match ? match[0] : null;
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1];
  }
  return trimmed;
}

function normalizeExtractionPayload(payload: unknown): MenuExtraction {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload was not an object");
  }

  const record = payload as Record<string, unknown>;
  const currency = sanitizeCurrency(
    typeof record.currency === "string" ? record.currency : null,
  );

  const rawCategories = Array.isArray(record.categories)
    ? record.categories
    : [];
  if (rawCategories.length > MAX_MENU_CATEGORIES) {
    throw new Error(
      `OpenAI response exceeded category limit (${MAX_MENU_CATEGORIES})`,
    );
  }

  type NormalizedItem = {
    name: string;
    description?: string | null;
    price?: number | string | null;
    flags?: string[];
  };

  const categoryBuckets = new Map<string, {
    name: string;
    items: NormalizedItem[];
    itemNames: Set<string>;
  }>();
  const orderedKeys: string[] = [];

  let totalItems = 0;
  for (const rawCategory of rawCategories) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const categoryRecord = rawCategory as Record<string, unknown>;
    const categoryName = typeof categoryRecord.name === "string"
      ? categoryRecord.name.trim()
      : "";
    if (!categoryName) continue;
    const categoryKey = categoryName.toLowerCase();
    let bucket = categoryBuckets.get(categoryKey);
    if (!bucket) {
      bucket = {
        name: categoryName,
        items: [],
        itemNames: new Set<string>(),
      };
      categoryBuckets.set(categoryKey, bucket);
      orderedKeys.push(categoryKey);
    }

    const rawItems = Array.isArray(categoryRecord.items)
      ? categoryRecord.items
      : [];
    if (rawItems.length === 0) continue;

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const itemRecord = rawItem as Record<string, unknown>;
      const itemName = typeof itemRecord.name === "string"
        ? itemRecord.name.trim()
        : "";
      if (!itemName) continue;
      const itemKey = itemName.toLowerCase();
      if (bucket.itemNames.has(itemKey)) continue;

      let description: string | null = null;
      if (typeof itemRecord.description === "string") {
        const desc = itemRecord.description.trim();
        description = desc.length ? desc : null;
      }

      const rawFlags = Array.isArray(itemRecord.flags) ? itemRecord.flags : [];
      const flags: string[] = [];
      for (const candidate of rawFlags) {
        if (typeof candidate !== "string") continue;
        const flagValue = candidate.trim().toLowerCase();
        if (!flagValue || !VALID_FLAGS.has(flagValue)) continue;
        if (!flags.includes(flagValue)) flags.push(flagValue);
      }

      let price: number | string | null = null;
      const rawPrice = (itemRecord as { price?: unknown }).price;
      if (
        typeof rawPrice === "number" ||
        (typeof rawPrice === "string" && rawPrice.trim().length > 0)
      ) {
        price = rawPrice;
      }

      if (totalItems + 1 > MAX_MENU_ITEMS) {
        throw new Error(
          `OpenAI response exceeded item limit (${MAX_MENU_ITEMS})`,
        );
      }

      bucket.items.push({
        name: itemName,
        description,
        price,
        flags,
      });
      bucket.itemNames.add(itemKey);
      totalItems += 1;
    }
  }

  const categories: Array<{
    name: string;
    items: NormalizedItem[];
  }> = [];
  for (const key of orderedKeys) {
    const bucket = categoryBuckets.get(key);
    if (!bucket || bucket.items.length === 0) continue;
    categories.push({ name: bucket.name, items: bucket.items });
  }

  if (!categories.length) {
    throw new Error("OpenAI response contained no usable menu items");
  }

  return { currency, categories };
}

async function cleanupMenuDraft(client: SupabaseClient, menuId: string) {
  await Promise.allSettled([
    client.from("items").delete().eq("menu_id", menuId),
    client.from("categories").delete().eq("menu_id", menuId),
  ]);
  await client.from("menus").delete().eq("id", menuId);
}

async function sendMenuReadyNotification(
  client: SupabaseClient,
  barId: string,
): Promise<void> {
  try {
    const { queueNotification } = await import(
      "../wa-webhook/services/notifications/queue.ts"
    );
    const { data: numbers, error: numbersError } = await client
      .from("bar_numbers")
      .select("number_e164, role")
      .eq("bar_id", barId)
      .eq("is_active", true)
      .in("role", ["manager", "staff"]);
    if (numbersError) throw numbersError;

    const recipients = (numbers ?? [])
      .map((row: { number_e164?: string | null }) => row.number_e164)
      .filter((value: unknown): value is string =>
        typeof value === "string" && value.length > 0
      );
    if (!recipients.length) {
      console.warn("ocr.notify_menu_ready_skip", {
        barId,
        reason: "no_recipients",
      });
      return;
    }

    const { data: barRow, error: barError } = await client
      .from("bars")
      .select("name")
      .eq("id", barId)
      .maybeSingle();
    if (barError && barError.code !== "PGRST116") throw barError;

    const headerText = barRow?.name ?? undefined;
    const bodyText =
      "Menu added successfully ✅\nItems are now live.\nNote: Ranked alphabetically first; later, most ordered will move to the top.";
    const rows = [
      { id: IDS.DINEIN_BARS_REVIEW, title: "Review & edit menu" },
      { id: IDS.DINEIN_BARS_MANAGE_ORDERS, title: "Manage orders" },
      { id: IDS.DINEIN_BARS_UPLOAD, title: "Upload/Update menu" },
      { id: IDS.DINEIN_BARS_NUMBERS_MENU, title: "Add WhatsApp numbers" },
      { id: IDS.BACK_MENU, title: "← Back" },
    ];

    console.log("ocr.notify_menu_ready_start", {
      barId,
      recipients,
    });

    await Promise.allSettled(
      recipients.map((to: string) =>
        queueNotification({
          to,
          interactive: {
            type: "list",
            headerText,
            bodyText,
            buttonText: "View",
            sectionTitle: "Manager console",
            rows,
          },
        }, {
          supabase: client,
          type: "menu_ready",
          bar_id: barId,
        })
      ),
    );
    console.log("ocr.notify_menu_ready_done", { barId });
  } catch (error) {
    console.error("ocr.notify_menu_ready_fail", error, { barId });
  }
}

function normalizePrice(price: unknown): number {
  const clamp = (value: number) => (value < 0 ? 0 : Math.round(value));
  if (typeof price === "number") {
    if (!Number.isFinite(price)) return 0;
    return Number.isInteger(price) ? clamp(price) : clamp(price * 100);
  }
  if (typeof price === "string") {
    const trimmed = price.trim();
    if (!trimmed) return 0;
    const sanitized = trimmed.replace(/[^0-9.,-]/g, "");
    if (!sanitized) return 0;
    const withoutSign = sanitized.startsWith("-")
      ? sanitized.slice(1)
      : sanitized;
    const decimalMatch = withoutSign.match(/[.,](\d{1,2})$/);
    if (decimalMatch) {
      const fractional = decimalMatch[1];
      const integerPart = withoutSign
        .slice(0, -decimalMatch[0].length)
        .replace(/[.,]/g, "");
      const numeric = Number.parseFloat(`${integerPart || "0"}.${fractional}`);
      if (!Number.isFinite(numeric)) return 0;
      return clamp(numeric * 100);
    }
    const digitsOnly = withoutSign.replace(/[.,]/g, "");
    if (!digitsOnly) return 0;
    const numeric = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(numeric) ? clamp(numeric) : 0;
  }
  return 0;
}

function buildMenuPrompt() {
  const system =
    "You are an assistant that extracts structured restaurant menu data from images. Always respond with strict JSON matching the schema.";
  const user = `Extract menu information. Output JSON:
{
  "currency": string | null,
  "categories": [
    {
      "name": string,
      "items": [
        {
          "name": string,
          "description": string | null,
          "price": number (minor currency units or cents),
          "flags": string[] (subset of ["spicy","hot","gluten_free","veg","vegan","halal"])
        }
      ]
    }
  ]
}
If prices appear in major units (e.g., 4.50), multiply by 100 to convert to minor units.
Infer dietary flags from keywords (e.g., "spicy", "vegan").
If multiple currencies appear, choose the dominant one.`;
  return { system, user };
}

interface MenuExtraction {
  currency?: string | null;
  categories?: Array<{
    name: string;
    items?: Array<{
      name: string;
      description?: string | null;
      price?: number | string | null;
      flags?: string[];
    }>;
  }>;
}

export { normalizeExtractionPayload, normalizePrice };
export type { MenuExtraction, OcrWorkerDeps };
