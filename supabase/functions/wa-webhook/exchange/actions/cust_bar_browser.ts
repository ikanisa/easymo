import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { decodePageToken, encodePageToken } from "../helpers.ts";

const LIMIT = 10;
const DEFAULT_AREA_OPTION = { id: "all", title: "All areas" };

export async function handleCustomerBarBrowser(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_show_results":
      return await listBars(req, 0, true);
    case "a_paged_bars": {
      const offset = decodePageToken(req.page_token);
      return await listBars(req, offset, false);
    }
    case "a_select_bar":
      return await selectBar(req);
    case "a_open_menu":
      return await openMenu(req);
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

async function listBars(
  req: FlowExchangeRequest,
  offset: number,
  includeAreas: boolean,
): Promise<FlowExchangeResponse> {
  const qRaw = typeof req.filters?.q === "string"
    ? req.filters.q
    : (typeof req.fields?.q === "string" ? req.fields.q : "");
  const areaRaw = typeof req.filters?.area === "string"
    ? req.filters.area
    : (typeof req.fields?.area === "string" ? req.fields.area : "");
  const q = qRaw?.trim() ?? "";
  const area = areaRaw?.trim() ?? "";

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

  query = query.order("name", { ascending: true }).range(
    offset,
    offset + LIMIT - 1,
  );

  const tasks = [query] as const;
  const areasTask = includeAreas
    ? supabase
      .from("bars")
      .select("city_area")
      .eq("is_active", true)
      .order("city_area", { ascending: true })
    : Promise.resolve({ data: null } as const);
  const [{ data: barsData, error }, areaList] = await Promise.all([
    tasks[0],
    areasTask,
  ]);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: `Failed to load bars: ${error.message}`,
      }],
    };
  }

  const rows = (barsData ?? []).map((bar) => ({
    id: bar.id,
    title: bar.name,
    description: buildLocationLabel(bar),
  }));

  const nextOffset = (barsData?.length ?? 0) === LIMIT ? offset + LIMIT : null;
  const prevOffset = offset > 0 ? Math.max(offset - LIMIT, 0) : null;

  const areas = includeAreas
    ? buildAreaOptions(areaList?.data ?? [])
    : undefined;

  return {
    next_screen_id: "s_bar_results",
    data: {
      bars: rows,
      areas,
      q,
      area,
      page_token_next: nextOffset !== null ? encodePageToken(nextOffset) : null,
      page_token_prev: prevOffset !== null ? encodePageToken(prevOffset) : null,
    },
  };
}

function buildAreaOptions(
  rows: Array<{ city_area: string | null }>,
): Array<{ id: string; title: string }> {
  const options: Array<{ id: string; title: string }> = [DEFAULT_AREA_OPTION];
  const seen = new Set<string>();
  for (const row of rows) {
    const raw = row.city_area?.trim();
    if (!raw) continue;
    const id = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
      /^-+|-+$/g,
      "",
    );
    if (!id || seen.has(id)) continue;
    seen.add(id);
    options.push({ id, title: raw });
  }
  return options;
}

async function selectBar(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = typeof req.fields?.bar_id === "string"
    ? req.fields.bar_id
    : (req.context?.bar_id as string | undefined);
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar selection" }],
    };
  }
  const { data, error } = await supabase
    .from("bars")
    .select(
      "id, name, location_text, city_area, country, momo_code, currency, is_active, bar_settings(allow_direct_customer_chat)",
    )
    .eq("id", barId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar not found" }],
    };
  }
  let chatNumber = "";
  if (data.bar_settings?.allow_direct_customer_chat) {
    const { data: directNumbers } = await supabase
      .from("bar_numbers")
      .select("number_e164")
      .eq("bar_id", barId)
      .eq("is_active", true)
      .order("role", { ascending: true })
      .limit(1);
    if (directNumbers && directNumbers.length) {
      chatNumber = directNumbers[0].number_e164 ?? "";
    }
  }
  return {
    next_screen_id: "s_bar_detail",
    data: {
      bar_id: data.id,
      bar_name: data.name,
      location_text: buildLocationLabel(data),
      momo_supported: data.momo_code ? "Yes" : "No",
      direct_chat_allowed: chatNumber.length > 0 ? "true" : "false",
      bar_public_number: chatNumber,
      bar_chat_url: chatNumber.length ? buildChatUrl(chatNumber) : "",
    },
  };
}

async function openMenu(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = typeof req.fields?.bar_id === "string"
    ? req.fields.bar_id
    : undefined;
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

type BarLocationLike = {
  location_text?: string | null;
  city_area?: string | null;
  country?: string | null;
};

function buildLocationLabel(bar: BarLocationLike): string {
  const parts = [bar.location_text, bar.city_area, bar.country]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];
  return parts.join(" · ");
}

function buildChatUrl(number: string): string {
  const digits = number.replace(/[^0-9]/g, "");
  return digits.length ? `https://wa.me/${digits}` : "";
}
