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
}

interface OcrWorkerDeps {
  fetchQueuedJob: () => Promise<OcrJob | null>;
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
    barId: string,
    extraction: MenuExtraction,
  ) => Promise<void>;
}

const globalFlags = globalThis as { __DISABLE_OCR_SERVER__?: boolean };

let defaultDeps: OcrWorkerDeps | null = null;

const SUPABASE_MODULE = globalFlags.__DISABLE_OCR_SERVER__
  ? "./supabase_client_stub.ts"
  : "https://esm.sh/@supabase/supabase-js@2.45.0";

function createDefaultDeps(client: SupabaseClient): OcrWorkerDeps {
  return {
    fetchQueuedJob: () => fetchQueuedJob(client),
    updateJobStatus: (id, status, options) =>
      updateJobStatus(client, id, status, options),
    downloadSourceFile: (path) => downloadSourceFile(client, path),
    runOpenAiExtraction: (imageBase64, contentType) =>
      runOpenAiExtraction(imageBase64, contentType),
    storeExtractionResult: (jobId, raw) =>
      storeExtractionResult(client, jobId, raw),
    upsertMenuFromExtraction: (barId, extraction) =>
      upsertMenuFromExtraction(client, barId, extraction),
  };
}

export async function processNextJob(
  deps?: OcrWorkerDeps,
): Promise<{ status: "no_job" } | { status: "processed"; jobId: string }> {
  const activeDeps = deps ?? defaultDeps;
  if (!activeDeps) {
    throw new Error("OCR worker dependencies not initialised");
  }

  const job = await activeDeps.fetchQueuedJob();
  if (!job) return { status: "no_job" };

  await activeDeps.updateJobStatus(job.id, "processing");
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
    await activeDeps.upsertMenuFromExtraction(job.bar_id, extraction.data);
    await activeDeps.updateJobStatus(job.id, "succeeded", { resultPath });
    return { status: "processed", jobId: job.id };
  } catch (error) {
    await activeDeps.updateJobStatus(job.id, "failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
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
        return new Response("No jobs", { status: 200 });
      }
      return new Response("Job processed", { status: 200 });
    } catch (error) {
      console.error("ocr.job_failed", error);
      return new Response("Job failed", { status: 500 });
    }
  });
}

async function fetchQueuedJob(client: SupabaseClient): Promise<OcrJob | null> {
  const { data, error } = await client
    .from("ocr_jobs")
    .select("id, bar_id, source_file_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as OcrJob | null;
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
  const { error } = await client.from("ocr_jobs").update(update).eq("id", id);
  if (error) throw error;
}

async function downloadSourceFile(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from(MENU_MEDIA_BUCKET).download(
    path,
  );
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const contentType = data.type ?? "application/octet-stream";
  return { base64Data, contentType };
}

async function runOpenAiExtraction(imageBase64: string, contentType: string) {
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
  if (!content) {
    throw new Error("OpenAI response lacked content");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    throw new Error("Failed to parse OpenAI JSON response");
  }

  return { raw: content, data: parsed as MenuExtraction };
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
  barId: string,
  extraction: MenuExtraction,
) {
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

  const { data: menu, error: menuError } = await client
    .from("menus")
    .insert({
      bar_id: barId,
      status: "draft",
      version: nextVersion,
      source: "ocr",
    })
    .select("id")
    .single();
  if (menuError) throw menuError;

  const menuId = (menu as { id: string }).id;

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
          flags,
          is_available: true,
          sort_order: itemOrder,
        });
      if (itemError) throw itemError;
      itemOrder += 1;
    }
    categoryOrder += 1;
  }
}

function normalizePrice(price: unknown): number {
  if (typeof price === "number") {
    return Math.round(price);
  }
  if (typeof price === "string") {
    const numeric = parseFloat(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
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

export type { MenuExtraction, OcrWorkerDeps };
