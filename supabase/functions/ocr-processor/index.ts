import { IDS } from "../wa-webhook/wa/ids.ts";
import { SupabaseRest } from "./supabase_rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SERVICE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";
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

type SupabaseClient = SupabaseRest;

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
  publishMenu: (barId: string, menuId: string) => Promise<void>;
}

const globalFlags = globalThis as { __DISABLE_OCR_SERVER__?: boolean };

let defaultDeps: OcrWorkerDeps | null = null;

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
    publishMenu: (barId, menuId) => publishMenu(client, barId, menuId),
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
    await activeDeps.publishMenu(job.bar_id, menuId);
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
  const supabase = new SupabaseRest(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  );
  defaultDeps = createDefaultDeps(supabase);

  Deno.serve(async () => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Missing SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }
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
      const message = error instanceof Error
        ? `${error.name ?? "Error"}: ${error.message}`
        : String(error ?? "unknown_error");
      return new Response(message, { status: 500 });
    }
  });
}

async function claimNextJob(client: SupabaseClient): Promise<OcrJob | null> {
  const { data, error } = await client.select<OcrJob>("ocr_jobs", {
    columns: "id, bar_id, source_file_id, attempts",
    filters: [{ column: "status", operator: "eq", value: "queued" }],
    order: { column: "created_at", ascending: true },
    limit: CLAIM_CANDIDATE_LIMIT,
  });
  if (error) throw new Error(error.message);

  const candidates = Array.isArray(data) ? data : [];
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    const attempts = (candidate as { attempts?: number }).attempts ?? 0;
    if (attempts >= MAX_JOB_ATTEMPTS) {
      const failResult = await client.update("ocr_jobs", {
        status: "failed",
        updated_at: now,
        last_attempt_at: now,
        error_message:
          `Exceeded max attempts (${MAX_JOB_ATTEMPTS}) without successful processing`,
      }, {
        filters: [
          { column: "id", operator: "eq", value: candidate.id },
          { column: "status", operator: "eq", value: "queued" },
        ],
      });
      if (failResult.error) throw new Error(failResult.error.message);
      continue;
    }

    const claimed = await client.update<OcrJob>("ocr_jobs", {
      status: "processing",
      updated_at: now,
      last_attempt_at: now,
      attempts: attempts + 1,
    }, {
      filters: [
        { column: "id", operator: "eq", value: candidate.id },
        { column: "status", operator: "eq", value: "queued" },
      ],
      returning: true,
      single: true,
    });

    if (claimed.error) throw new Error(claimed.error.message);
    if (claimed.data) {
      return claimed.data as OcrJob;
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
  const { error } = await client.update("ocr_jobs", update, {
    filters: [{ column: "id", operator: "eq", value: id }],
  });
  if (error) throw new Error(error.message);
}

async function downloadSourceFile(client: SupabaseClient, path: string) {
  const { bytes, contentType } = await client.storageDownload(
    MENU_MEDIA_BUCKET,
    path,
  );
  const base64Data = bytesToBase64(bytes);
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
  await client.storageUpload(OCR_RESULT_BUCKET, path, raw, {
    contentType: "application/json",
    upsert: true,
  });
  return path;
}

async function upsertMenuFromExtraction(
  client: SupabaseClient,
  job: OcrJob,
  extraction: MenuExtraction,
): Promise<string> {
  const barId = job.bar_id;
  const latestVersion = await client.select<{ version?: number }>(
    "menus",
    {
      columns: "version",
      filters: [{ column: "bar_id", operator: "eq", value: barId }],
      order: { column: "version", ascending: false },
      limit: 1,
      single: "maybe",
    },
  );
  if (latestVersion.error) throw new Error(latestVersion.error.message);
  const nextVersion = ((latestVersion.data?.version) ?? 0) + 1;

  const currency = sanitizeCurrency(extraction.currency ?? undefined);
  let menuId: string | null = null;

  try {
    const menuInsert = await client.insert<{ id: string }>(
      "menus",
      {
        bar_id: barId,
        status: "draft",
        version: nextVersion,
        source: "ocr",
        source_file_ids: job.source_file_id ? [job.source_file_id] : [],
      },
      { returning: true, single: true },
    );
    if (menuInsert.error || !menuInsert.data) {
      throw new Error(menuInsert.error?.message ?? "Failed to create menu");
    }
    menuId = menuInsert.data.id;

    let categoryOrder = 0;
    for (const category of extraction.categories ?? []) {
      const categoryInsert = await client.insert<{ id: string }>(
        "categories",
        {
          bar_id: barId,
          menu_id: menuId,
          parent_category_id: null,
          name: category.name,
          sort_order: categoryOrder,
        },
        { returning: true, single: true },
      );
      if (categoryInsert.error || !categoryInsert.data) {
        throw new Error(
          categoryInsert.error?.message ?? "Failed to create category",
        );
      }
      const categoryId = categoryInsert.data.id;

      const itemsPayload = (category.items ?? []).map((item, index) => ({
        bar_id: barId,
        menu_id: menuId,
        category_id: categoryId,
        name: item.name,
        short_description: item.description ?? null,
        price_minor: normalizePrice(item.price),
        currency,
        flags: Array.isArray(item.flags) ? item.flags : [],
        is_available: true,
        sort_order: index,
      }));

      if (itemsPayload.length) {
        const itemsInsert = await client.insert("items", itemsPayload, {
          returning: false,
        });
        if (itemsInsert.error) {
          throw new Error(itemsInsert.error.message);
        }
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

async function publishMenu(
  client: SupabaseClient,
  barId: string,
  menuId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();

  const archiveResult = await client.update("menus", {
    status: "archived",
  }, {
    filters: [
      { column: "bar_id", operator: "eq", value: barId },
      { column: "source", operator: "eq", value: "ocr" },
      { column: "id", operator: "ne" as any, value: menuId },
    ],
  });
  if (archiveResult.error) {
    console.error("ocr.publish.archive_fail", archiveResult.error);
  }

  const publishResult = await client.update("menus", {
    status: "published",
    published_at: nowIso,
  }, {
    filters: [{ column: "id", operator: "eq", value: menuId }],
  });
  if (publishResult.error) {
    console.error("ocr.publish.publish_fail", publishResult.error);
    throw new Error(publishResult.error.message);
  }

  await client.update("bars", {
    is_active: true,
    updated_at: nowIso,
  }, {
    filters: [{ column: "id", operator: "eq", value: barId }],
  });
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
    client.delete("items", {
      filters: [{ column: "menu_id", operator: "eq", value: menuId }],
    }),
    client.delete("categories", {
      filters: [{ column: "menu_id", operator: "eq", value: menuId }],
    }),
  ]);
  await client.delete("menus", {
    filters: [{ column: "id", operator: "eq", value: menuId }],
  });
}

async function sendMenuReadyNotification(
  client: SupabaseClient,
  barId: string,
): Promise<void> {
  try {
    const recipientsResult = await client.select<{ number_e164?: string }>(
      "bar_numbers",
      {
        columns: "number_e164",
        filters: [
          { column: "bar_id", operator: "eq", value: barId },
          { column: "is_active", operator: "eq", value: "true" },
          { column: "role", operator: "in", value: ["manager", "staff"] },
        ],
      },
    );
    if (recipientsResult.error) {
      throw new Error(recipientsResult.error.message);
    }

    const recipients =
      (Array.isArray(recipientsResult.data) ? recipientsResult.data : [])
        .map((row) => row.number_e164)
        .filter((value): value is string => typeof value === "string" && value);
    if (!recipients.length) {
      console.warn("ocr.notify_menu_ready_skip", {
        barId,
        reason: "no_recipients",
      });
      return;
    }

    const barResult = await client.select<{ name?: string }>("bars", {
      columns: "name",
      filters: [{ column: "id", operator: "eq", value: barId }],
      single: "maybe",
    });
    if (barResult.error) {
      throw new Error(barResult.error.message);
    }

    const headerText = barResult.data?.name ?? undefined;
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

    const notificationsPayload = recipients.map((to) => ({
      to_wa_id: to,
      notification_type: "menu_ready",
      template_name: null,
      order_id: null,
      channel: "freeform",
      payload: {
        interactive: {
          type: "list",
          headerText,
          bodyText,
          buttonText: "View",
          sectionTitle: "Manager console",
          rows,
        },
      },
      status: "queued",
      retry_count: 0,
    }));

    const insertResult = await client.insert(
      "notifications",
      notificationsPayload,
    );
    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }
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
