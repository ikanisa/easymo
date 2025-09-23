import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";

export async function handleVendorStaff(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_staff_refresh":
      return await refreshStaff(req);
    case "a_staff_add":
      return await addStaff(req);
    case "a_staff_remove":
      return await removeStaff(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
      };
  }
}

async function refreshStaff(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  if (!barId) return missingBar(req);
  const { data, error } = await supabase
    .from("bar_numbers")
    .select("id, number_e164, role, is_active")
    .eq("bar_id", barId);
  if (error) return failure(req, "Failed to load staff");
  return {
    next_screen_id: "s_staff_list",
    data: {
      bar_id: barId,
      staff_text: (data ?? []).map((n) => `${n.role.toUpperCase()}: ${n.number_e164}${n.is_active ? "" : " (inactive)"}`).join("\n"),
      staff_options: (data ?? []).map((n) => ({ id: n.number_e164, title: `${n.number_e164} (${n.role})` })),
    },
  };
}

async function addStaff(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const phone = String(req.fields?.phone ?? "").trim();
  const role = String(req.fields?.role ?? "staff").toLowerCase();
  if (!barId || !phone) return missingBar(req);
  await supabase
    .from("bar_numbers")
    .insert({ bar_id: barId, number_e164: phone, role: role === "manager" ? "manager" : "staff" })
    .onConflict("bar_id,number_e164")
    .ignore();
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Staff added. Verification pending." }],
  };
}

async function removeStaff(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const phone = String(req.fields?.phone ?? "").trim();
  if (!barId || !phone) return missingBar(req);
  await supabase
    .from("bar_numbers")
    .update({ is_active: false })
    .eq("bar_id", barId)
    .eq("number_e164", phone);
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Staff removed." }],
  };
}

function missingBar(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: "Missing bar context" }],
  };
}

function failure(req: FlowExchangeRequest, message: string): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: message }],
  };
}
