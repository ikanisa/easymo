/**
 * Menu Domain Handler
 * Processes restaurant/bar menu OCR requests
 * Ported from ocr-processor
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { runOpenAIVision } from "../core/openai.ts";
import { fetchQueuedJobs, claimJob, updateJobStatus, countQueuedJobs, determineNextStatus } from "../core/queue.ts";
import { downloadAsBase64, uploadFile } from "../core/storage.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { MENU_SCHEMA } from "../schemas/menu.ts";
import { IDS } from "../../wa-webhook/wa/ids.ts";

const MENU_MEDIA_BUCKET = Deno.env.get("MENU_MEDIA_BUCKET") ?? "menu-source-files";
const OCR_RESULT_BUCKET = Deno.env.get("OCR_RESULT_BUCKET") ?? "ocr-json-cache";
const MAX_ATTEMPTS = 3;
const MAX_MENU_CATEGORIES = 50;
const MAX_MENU_ITEMS = 500;

const VALID_FLAGS = new Set([
  "spicy",
  "hot",
  "gluten_free",
  "veg",
  "vegan",
  "halal",
]);

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

/**
 * Process menu queue (batch mode)
 */
export async function processMenuQueue(
  client: SupabaseClient,
  limit: number,
): Promise<Response> {
  const jobs = await fetchQueuedJobs(client, {
    tableName: "ocr_jobs",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: limit,
  });

  if (!jobs.length) {
    return jsonResponse({ processed: [], remaining: 0 });
  }

  const processed = [];

  for (const job of jobs) {
    const result = await processMenuJob(client, job);
    processed.push(result);
  }

  const remaining = await countQueuedJobs(client, {
    tableName: "ocr_jobs",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: limit,
  });

  return jsonResponse({ processed, remaining });
}

/**
 * Process single menu job from queue
 */
async function processMenuJob(
  client: SupabaseClient,
  job: any,
): Promise<any> {
  const attempts = (job.attempts ?? 0) + 1;

  // Check if already exceeded max attempts
  if (attempts > MAX_ATTEMPTS) {
    await updateJobStatus(client, {
      tableName: "ocr_jobs",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, "failed", {
      error_message: `Exceeded max attempts (${MAX_ATTEMPTS})`,
    });
    return { id: job.id, status: "failed", error: "max_attempts_exceeded" };
  }

  // Try to claim the job
  const claimed = await claimJob(client, {
    tableName: "ocr_jobs",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: 0,
  }, job.id, job.attempts ?? 0);

  if (!claimed) {
    return { id: job.id, status: "skipped", reason: "already_processing" };
  }

  let menuId: string | null = null;

  try {
    // Download source file
    const { base64Data, contentType } = await downloadAsBase64(
      client,
      MENU_MEDIA_BUCKET,
      job.source_file_id,
    );

    // Run OCR extraction
    const extraction = await runMenuOCR(base64Data, contentType);

    // Store extraction result
    const resultPath = await storeExtractionResult(client, job.id, extraction.raw);

    // Create menu from extraction
    menuId = await upsertMenuFromExtraction(client, job, extraction.data);

    // Mark job as succeeded
    await updateJobStatus(client, {
      tableName: "ocr_jobs",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, "succeeded", {
      result_path: resultPath,
      menu_id: menuId,
      error_message: null,
    });

    // Publish menu
    await publishMenu(client, job.bar_id, menuId);

    // Notify bar managers
    await sendMenuReadyNotification(client, job.bar_id);

    await logStructuredEvent("MENU_OCR_SUCCESS", {
      jobId: job.id,
      barId: job.bar_id,
      menuId,
    }, "info");

    return { id: job.id, status: "succeeded", menuId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = determineNextStatus(attempts, MAX_ATTEMPTS);

    await updateJobStatus(client, {
      tableName: "ocr_jobs",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, nextStatus, {
      error_message: message.substring(0, 500),
      menu_id: menuId,
    });

    await logStructuredEvent("MENU_OCR_FAIL", {
      jobId: job.id,
      barId: job.bar_id,
      error: message,
    }, "error");

    return { id: job.id, status: nextStatus, error: message, menuId };
  }
}

/**
 * Run menu OCR extraction
 */
async function runMenuOCR(
  imageBase64: string,
  contentType: string,
): Promise<{ raw: string; data: MenuExtraction }> {
  const prompt = buildMenuPrompt();

  const response = await runOpenAIVision({
    imageBase64,
    contentType,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    schema: MENU_SCHEMA,
    maxTokens: 2000,
  });

  const normalized = normalizeMenuExtraction(response.parsed);
  return { raw: response.raw, data: normalized };
}

/**
 * Store extraction result in cache bucket
 */
async function storeExtractionResult(
  client: SupabaseClient,
  jobId: string,
  raw: string,
): Promise<string> {
  const path = `results/${jobId}.json`;
  await uploadFile(client, OCR_RESULT_BUCKET, path, raw, {
    contentType: "application/json",
    upsert: true,
  });
  return path;
}

/**
 * Create or update menu from extraction
 */
async function upsertMenuFromExtraction(
  client: SupabaseClient,
  job: any,
  extraction: MenuExtraction,
): Promise<string> {
  const barId = job.bar_id;

  // Get next version number
  const { data: latestVersion } = await client
    .from("menus")
    .select("version")
    .eq("bar_id", barId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const currency = sanitizeCurrency(extraction.currency);

  let menuId: string | null = null;

  try {
    // Create menu
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

    if (menuError || !menu) {
      throw new Error(menuError?.message ?? "Failed to create menu");
    }

    menuId = menu.id;

    // Insert categories and items
    let categoryOrder = 0;
    for (const category of extraction.categories ?? []) {
      const { data: cat, error: catError } = await client
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

      if (catError || !cat) {
        throw new Error(catError?.message ?? "Failed to create category");
      }

      const categoryId = cat.id;

      // Insert items
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
        const { error: itemsError } = await client
          .from("items")
          .insert(itemsPayload);

        if (itemsError) {
          throw new Error(itemsError.message);
        }
      }

      categoryOrder += 1;
    }

    return menuId;
  } catch (error) {
    // Cleanup on error
    if (menuId) {
      await cleanupMenuDraft(client, menuId);
    }
    throw error;
  }
}

/**
 * Publish menu and archive old menus
 */
async function publishMenu(
  client: SupabaseClient,
  barId: string,
  menuId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Archive old OCR menus
  await client
    .from("menus")
    .update({ status: "archived" })
    .eq("bar_id", barId)
    .eq("source", "ocr")
    .neq("id", menuId);

  // Publish new menu
  const { error } = await client
    .from("menus")
    .update({
      status: "published",
      published_at: now,
    })
    .eq("id", menuId);

  if (error) {
    throw new Error(error.message);
  }

  // Activate bar
  await client
    .from("bars")
    .update({
      is_active: true,
      updated_at: now,
    })
    .eq("id", barId);
}

/**
 * Send WhatsApp notification to bar managers
 */
async function sendMenuReadyNotification(
  client: SupabaseClient,
  barId: string,
): Promise<void> {
  try {
    // Get bar managers
    const { data: recipients } = await client
      .from("bar_numbers")
      .select("number_e164")
      .eq("bar_id", barId)
      .eq("is_active", true)
      .in("role", ["manager", "staff"]);

    const numbers = (recipients ?? [])
      .map((r) => r.number_e164)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    if (!numbers.length) {
      await logStructuredEvent("MENU_NOTIFY_SKIP", {
        barId,
        reason: "no_recipients",
      }, "warn");
      return;
    }

    // Get bar name
    const { data: bar } = await client
      .from("bars")
      .select("name")
      .eq("id", barId)
      .maybeSingle();

    const headerText = bar?.name ?? undefined;
    const bodyText =
      "Menu added successfully ✅\nItems are now live.\nNote: Ranked alphabetically first; later, most ordered will move to the top.";
    const rows = [{ id: IDS.BACK_MENU, title: "← Back" }];

    // Queue notifications
    const notificationsPayload = numbers.map((to) => ({
      to_wa_id: to,
      notification_type: "menu_ready",
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

    await client.from("notifications").insert(notificationsPayload);

    await logStructuredEvent("MENU_NOTIFY_SENT", {
      barId,
      count: numbers.length,
    }, "info");
  } catch (error) {
    await logStructuredEvent("MENU_NOTIFY_FAIL", {
      barId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
  }
}

/**
 * Cleanup menu draft on error
 */
async function cleanupMenuDraft(
  client: SupabaseClient,
  menuId: string,
): Promise<void> {
  await Promise.allSettled([
    client.from("items").delete().eq("menu_id", menuId),
    client.from("categories").delete().eq("menu_id", menuId),
  ]);
  await client.from("menus").delete().eq("id", menuId);
}

/**
 * Normalize menu extraction payload
 */
function normalizeMenuExtraction(payload: any): MenuExtraction {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid menu extraction payload");
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
      `Menu exceeded category limit (${MAX_MENU_CATEGORIES})`,
    );
  }

  const categoryBuckets = new Map<
    string,
    { name: string; items: any[]; itemNames: Set<string> }
  >();
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
      bucket = { name: categoryName, items: [], itemNames: new Set() };
      categoryBuckets.set(categoryKey, bucket);
      orderedKeys.push(categoryKey);
    }

    const rawItems = Array.isArray(categoryRecord.items)
      ? categoryRecord.items
      : [];

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const itemRecord = rawItem as Record<string, unknown>;
      const itemName = typeof itemRecord.name === "string"
        ? itemRecord.name.trim()
        : "";
      if (!itemName) continue;

      const itemKey = itemName.toLowerCase();
      if (bucket.itemNames.has(itemKey)) continue;

      const description = typeof itemRecord.description === "string"
        ? itemRecord.description.trim() || null
        : null;

      const rawFlags = Array.isArray(itemRecord.flags) ? itemRecord.flags : [];
      const flags: string[] = [];
      for (const candidate of rawFlags) {
        if (typeof candidate !== "string") continue;
        const flagValue = candidate.trim().toLowerCase();
        if (!flagValue || !VALID_FLAGS.has(flagValue)) continue;
        if (!flags.includes(flagValue)) flags.push(flagValue);
      }

      let price: number | string | null = null;
      const rawPrice = itemRecord.price;
      if (
        typeof rawPrice === "number" ||
        (typeof rawPrice === "string" && rawPrice.trim().length > 0)
      ) {
        price = rawPrice;
      }

      if (totalItems + 1 > MAX_MENU_ITEMS) {
        throw new Error(`Menu exceeded item limit (${MAX_MENU_ITEMS})`);
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

  const categories: Array<{ name: string; items: any[] }> = [];
  for (const key of orderedKeys) {
    const bucket = categoryBuckets.get(key);
    if (!bucket || bucket.items.length === 0) continue;
    categories.push({ name: bucket.name, items: bucket.items });
  }

  if (!categories.length) {
    throw new Error("Menu extraction contained no usable items");
  }

  return { currency, categories };
}

/**
 * Normalize price to minor currency units
 */
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

/**
 * Sanitize currency code
 */
function sanitizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/[A-Z]{3}/);
  return match ? match[0] : null;
}

/**
 * Build menu extraction prompt
 */
function buildMenuPrompt() {
  return {
    system:
      "You are an assistant that extracts structured restaurant menu data from images. Always respond with strict JSON matching the schema.",
    user: `Extract menu information. Output JSON:
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
If multiple currencies appear, choose the dominant one.`,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
