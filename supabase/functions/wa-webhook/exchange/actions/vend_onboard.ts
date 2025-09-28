import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import {
  ensureSession,
  getBar,
  getOcrJobSummary,
  promoteDraftToPublished,
} from "../helpers.ts";
import type { OcrJobSummary } from "../helpers.ts";

export async function handleVendorOnboard(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_onboard_identity":
      return await saveIdentity(req);
    case "a_onboard_contacts":
      return await saveContacts(req);
    case "a_onboard_uploaded":
      return await acknowledgeUpload(req);
    case "a_publish_menu":
      return await publishMenu(req);
    case "a_link_existing_bar":
      return await linkExistingBar(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown action ${req.action_id}`,
        }],
      };
  }
}

async function saveIdentity(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barName = String(req.fields?.bar_name ?? "").trim();
  const slug = createSlug(barName);
  const location = String(req.fields?.location_text ?? "").trim();
  const country = String(req.fields?.country ?? "").trim();
  const city = String(req.fields?.city_area ?? "").trim();
  if (!barName || !slug) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar name required" }],
    };
  }
  const { data: existing, error: existingError } = await supabase
    .from("bars")
    .select(
      "id, name, location_text, city_area, country, slug, is_active",
    )
    .or(`slug.eq.${slug},name.ilike.%${barName}%`)
    .limit(5);
  if (existingError) {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: `Lookup failed: ${existingError.message}`,
      }],
    };
  }
  const slugMatch = existing?.find((row) => row.slug === slug);
  if (slugMatch) {
    return {
      next_screen_id: "s_existing_bar",
      data: {
        bar_name: barName,
        location_text: location,
        country,
        city_area: city,
        existing_bars: buildExistingBarOptions(existing ?? []),
      },
      messages: [{
        level: "warning",
        text: "We found an existing listing. Link it or adjust the bar name.",
      }],
    };
  }

  const { data, error } = await supabase
    .from("bars")
    .insert({
      name: barName,
      slug,
      location_text: location,
      country,
      city_area: city,
    })
    .select("id")
    .single();
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: `Failed to save bar: ${error.message}`,
      }],
    };
  }
  await ensureBarSettings(data.id);
  await ensureSession({
    waId: req.wa_id,
    role: "vendor_manager",
    barId: data.id,
    currentFlow: req.flow_id,
  });
  return {
    next_screen_id: "s_contact_payment",
    data: { bar_id: data.id },
  };
}

async function linkExistingBar(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const existingId = String(req.fields?.existing_bar_id ?? "");
  const barName = String(req.fields?.bar_name ?? "").trim();
  const location = String(req.fields?.location_text ?? "").trim();
  const country = String(req.fields?.country ?? "").trim();
  const city = String(req.fields?.city_area ?? "").trim();
  if (!existingId) {
    return {
      next_screen_id: "s_bar_identity",
      messages: [{ level: "error", text: "Select a bar to link." }],
    };
  }
  const { data, error } = await supabase
    .from("bars")
    .select(
      "id, name, slug, location_text, country, city_area",
    )
    .eq("id", existingId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: "s_bar_identity",
      messages: [{ level: "error", text: "Existing bar not found." }],
    };
  }

  const updates: Record<string, string> = {};
  if (location.length && !data.location_text) updates.location_text = location;
  if (country.length && !data.country) updates.country = country;
  if (city.length && !data.city_area) updates.city_area = city;
  if (barName.length && barName !== data.name) {
    updates.name = barName;
  }
  if (Object.keys(updates).length) {
    await supabase.from("bars").update(updates).eq("id", existingId);
  }
  await ensureBarSettings(existingId);
  await ensureSession({
    waId: req.wa_id,
    role: "vendor_manager",
    barId: existingId,
    currentFlow: req.flow_id,
  });
  return {
    next_screen_id: "s_contact_payment",
    data: { bar_id: existingId },
    messages: [{ level: "info", text: "Linked to existing bar." }],
  };
}

async function saveContacts(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? "");
  const numbersCsv = String(req.fields?.order_numbers_csv ?? "");
  const momoCode = String(req.fields?.momo_code ?? "").trim();
  if (!barId || !numbersCsv) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Numbers required" }],
    };
  }
  const numbers = numbersCsv.split(/[\s,]+/).map((n) => n.trim()).filter(
    Boolean,
  );
  for (const number of numbers) {
    await supabase
      .from("bar_numbers")
      .insert({ bar_id: barId, number_e164: number, role: "manager" })
      .onConflict("bar_id,number_e164")
      .ignore();
  }
  await supabase
    .from("bars")
    .update({ momo_code: momoCode })
    .eq("id", barId);
  await ensureBarSettings(barId);
  return {
    next_screen_id: "s_upload_menu_info",
    data: { bar_id: barId },
    messages: [{
      level: "info",
      text: "Contacts saved. Upload menu via chat.",
    }],
  };
}

async function acknowledgeUpload(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? "");
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar" }],
    };
  }

  const [summary, draftCounts] = await Promise.all([
    getOcrJobSummary(barId),
    loadDraftCounts(barId),
  ]);

  const pending = summary.counts.queued + summary.counts.processing;
  const failed = summary.counts.failed;
  const ocrSummaryText = buildOcrSummary(summary);
  const messages: Array<{ level: "info" | "warning" | "error"; text: string }> =
    [];

  if (summary.total === 0) {
    messages.push({
      level: "info",
      text: "Upload received. We'll parse your menu shortly.",
    });
  } else if (pending > 0) {
    messages.push({
      level: "info",
      text: "OCR still running. Refresh this screen in a minute for updates.",
    });
  } else if (failed > 0 && summary.counts.succeeded === 0) {
    messages.push({
      level: "warning",
      text: "Last OCR attempt failed. Try uploading a clearer menu photo.",
    });
  }

  return {
    next_screen_id: "s_onboard_publish",
    data: {
      bar_id: barId,
      ocr_summary_text: ocrSummaryText,
      ocr_pending_count: pending,
      ocr_failed_count: failed,
      draft_categories_count: draftCounts.categories,
      draft_items_count: draftCounts.items,
    },
    messages: messages.length ? messages : undefined,
  };
}

async function publishMenu(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? "");
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar" }],
    };
  }
  const { data: menu, error } = await supabase
    .from("menus")
    .select("id")
    .eq("bar_id", barId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !menu) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "No draft menu" }],
    };
  }
  try {
    const publishedMenuId = await promoteDraftToPublished({
      barId,
      draftMenuId: menu.id,
    });
    const { data: publishedMeta } = await supabase
      .from("menus")
      .select("version")
      .eq("id", publishedMenuId)
      .maybeSingle();
    await supabase
      .from("bars")
      .update({ is_active: true })
      .eq("id", barId);
    const versionText = publishedMeta?.version
      ? `Version ${publishedMeta.version}`
      : "Menu";
    return {
      next_screen_id: "s_onboard_done",
      messages: [{
        level: "info",
        text: `${versionText} published. You're live!`,
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: `Publish failed: ${message}` }],
    };
  }
}

async function loadDraftCounts(
  barId: string,
): Promise<{ categories: number; items: number }> {
  let categories = 0;
  let items = 0;
  const { data: draftMenu } = await supabase
    .from("menus")
    .select("id")
    .eq("bar_id", barId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const menuId = draftMenu?.id as string | undefined;
  if (menuId) {
    const [catRes, itemRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("menu_id", menuId)
        .eq("is_deleted", false),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("menu_id", menuId),
    ]);
    if (!catRes.error && typeof catRes.count === "number") {
      categories = catRes.count;
    }
    if (!itemRes.error && typeof itemRes.count === "number") {
      items = itemRes.count;
    }
  }
  return { categories, items };
}

function buildOcrSummary(summary: OcrJobSummary): string {
  if (summary.total === 0) {
    return "No OCR runs yet. Upload a menu to start.";
  }
  const pending = summary.counts.queued + summary.counts.processing;
  const lines = [
    `Pending: ${pending}`,
    `Completed: ${summary.counts.succeeded} | Failed: ${summary.counts.failed}`,
  ];
  if (summary.lastSuccessAt) {
    lines.push(`Last success: ${formatDateTime(summary.lastSuccessAt)}`);
  }
  if (summary.lastRunAt && summary.lastStatus) {
    lines.push(
      `Last update: ${
        formatDateTime(summary.lastRunAt)
      } (${summary.lastStatus})`,
    );
  }
  if (summary.lastErrorMessage) {
    lines.push(`Last error: ${summary.lastErrorMessage}`);
  }
  return lines.join("\n");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { hour12: false });
}

function createSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildExistingBarOptions(
  rows: Array<{
    id: string;
    name: string | null;
    location_text?: string | null;
    city_area?: string | null;
    country?: string | null;
    is_active?: boolean | null;
  }>,
): Array<{ id: string; title: string; description: string }> {
  return rows.map((row) => {
    const pieces = [row.location_text ?? row.city_area ?? "", row.country ?? ""]
      .filter(Boolean);
    const status = row.is_active ? "Live" : "Draft";
    return {
      id: row.id,
      title: row.name ?? "Existing bar",
      description: `${pieces.join(" · ")} (${status})`,
    };
  });
}

async function ensureBarSettings(barId: string): Promise<void> {
  await supabase
    .from("bar_settings")
    .upsert({ bar_id: barId }, { onConflict: "bar_id" });
}
