import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { ensureSession, getBar } from "../helpers.ts";

export async function handleVendorOnboard(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_onboard_identity":
      return await saveIdentity(req);
    case "a_onboard_contacts":
      return await saveContacts(req);
    case "a_onboard_uploaded":
      return await acknowledgeUpload(req);
    case "a_publish_menu":
      return await publishMenu(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
      };
  }
}

async function saveIdentity(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barName = String(req.fields?.bar_name ?? "").trim();
  const slug = barName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const location = String(req.fields?.location_text ?? "").trim();
  const country = String(req.fields?.country ?? "").trim();
  const city = String(req.fields?.city_area ?? "").trim();
  if (!barName || !slug) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar name required" }],
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
      messages: [{ level: "error", text: `Failed to save bar: ${error.message}` }],
    };
  }
  await ensureSession({ waId: req.wa_id, role: "vendor", barId: data.id, currentFlow: req.flow_id });
  return {
    next_screen_id: "s_contact_payment",
    data: { bar_id: data.id },
  };
}

async function saveContacts(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? "");
  const numbersCsv = String(req.fields?.order_numbers_csv ?? "");
  const momoCode = String(req.fields?.momo_code ?? "").trim();
  if (!barId || !numbersCsv) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Numbers required" }],
    };
  }
  const numbers = numbersCsv.split(/[\s,]+/).map((n) => n.trim()).filter(Boolean);
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
  await supabase
    .from("bar_settings")
    .upsert({ bar_id: barId, payment_instructions: null })
    .eq("bar_id", barId);
  return {
    next_screen_id: "s_upload_menu_info",
    data: { bar_id: barId },
    messages: [{ level: "info", text: "Contacts saved. Upload menu via chat." }],
  };
}

async function acknowledgeUpload(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.fields?.bar_id ?? "");
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar" }],
    };
  }
  const { data: jobCount } = await supabase
    .from("ocr_jobs")
    .select("id")
    .eq("bar_id", barId)
    .limit(1);
  return {
    next_screen_id: "s_onboard_publish",
    data: {
      bar_id: barId,
      last_ocr_status: jobCount && jobCount.length ? "processing" : "queued",
      draft_categories_count: 0,
      draft_items_count: 0,
    },
    messages: [{ level: "info", text: "OCR running. Review menu once ready." }],
  };
}

async function publishMenu(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
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
  const { error: publishErr } = await supabase
    .from("menus")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", menu.id);
  if (publishErr) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Publish failed" }],
    };
  }
  await supabase
    .from("bars")
    .update({ is_active: true })
    .eq("id", barId);
  return {
    next_screen_id: "s_onboard_done",
    messages: [{ level: "info", text: "Menu published. You're live!" }],
  };
}
