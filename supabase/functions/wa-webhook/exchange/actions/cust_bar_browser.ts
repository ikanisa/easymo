import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { decodePageToken, encodePageToken } from "../helpers.ts";

const LIMIT = 10;

export async function handleCustomerBarBrowser(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_show_results":
      return await listBars(req, 0);
    case "a_paged_bars": {
      const offset = decodePageToken(req.page_token);
      return await listBars(req, offset);
    }
    case "a_select_bar":
      return await selectBar(req);
    case "a_open_menu":
      return await openMenu(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
      };
  }
}

async function listBars(req: FlowExchangeRequest, offset: number): Promise<FlowExchangeResponse> {
  const q = typeof req.filters?.q === "string" ? req.filters?.q.trim() : (typeof req.fields?.q === "string" ? req.fields.q.trim() : "");
  const area = typeof req.filters?.area === "string" ? req.filters.area.trim() : (typeof req.fields?.area === "string" ? req.fields.area.trim() : "");

  let query = supabase
    .from("bars")
    .select("id, name, location_text, city_area, country, is_active")
    .eq("is_active", true);

  if (q) {
    query = query.or(`name.ilike.%${q}%,location_text.ilike.%${q}%`);
  }
  if (area && area !== "all") {
    query = query.ilike("city_area", `%${area}%`);
  }

  query = query.order("name", { ascending: true }).range(offset, offset + LIMIT - 1);

  const { data, error } = await query;
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: `Failed to load bars: ${error.message}` }],
    };
  }

  const rows = (data ?? []).map((bar) => ({
    id: bar.id,
    title: bar.name,
    description: bar.location_text ? `${bar.location_text}` : bar.city_area ?? "",
  }));

  const nextOffset = (data?.length ?? 0) === LIMIT ? offset + LIMIT : null;
  const prevOffset = offset > 0 ? Math.max(offset - LIMIT, 0) : null;

  return {
    next_screen_id: "s_bar_results",
    data: {
      bars: rows,
      q,
      area,
      page_token_next: nextOffset !== null ? encodePageToken(nextOffset) : null,
      page_token_prev: prevOffset !== null ? encodePageToken(prevOffset) : null,
    },
  };
}

async function selectBar(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = typeof req.fields?.bar_id === "string" ? req.fields.bar_id : (req.context?.bar_id as string | undefined);
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar selection" }],
    };
  }
  const { data, error } = await supabase
    .from("bars")
    .select("id, name, location_text, city_area, momo_code, currency, is_active, bar_settings(allow_direct_customer_chat)")
    .eq("id", barId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar not found" }],
    };
  }
  return {
    next_screen_id: "s_bar_detail",
    data: {
      bar_id: data.id,
      bar_name: data.name,
      location_text: data.location_text ?? data.city_area ?? "",
      momo_supported: data.momo_code ? "Yes" : "No",
      direct_chat_allowed: Boolean(data.bar_settings?.allow_direct_customer_chat),
      bar_public_number: "",
    },
  };
}

async function openMenu(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = typeof req.fields?.bar_id === "string" ? req.fields.bar_id : undefined;
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar id" }],
    };
  }
  return {
    next_screen_id: "s_categories",
    data: {
      bar_id: barId,
    },
    messages: [{ level: "info", text: "Loading menu..." }],
  };
}
