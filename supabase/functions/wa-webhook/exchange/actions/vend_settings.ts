import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";

export async function handleVendorSettings(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_save_settings":
      return await saveSettings(req);
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

async function saveSettings(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar" }],
    };
  }
  const momoCode = String(req.fields?.momo_code ?? "").trim();
  const servicePct =
    parseFloat(String(req.fields?.service_charge_pct ?? "0")) || 0;
  const allowChat = String(req.fields?.allow_direct_chat ?? "false") === "true";
  const prepMinutes =
    parseInt(String(req.fields?.default_prep_minutes ?? "0"), 10) || 0;
  const paymentInstructions = String(req.fields?.payment_instructions ?? "")
    .trim();
  await supabase
    .from("bars")
    .update({ momo_code: momoCode })
    .eq("id", barId);
  await supabase
    .from("bar_settings")
    .upsert({
      bar_id: barId,
      service_charge_pct: servicePct,
      allow_direct_customer_chat: allowChat,
      default_prep_minutes: prepMinutes,
      payment_instructions: paymentInstructions,
    })
    .eq("bar_id", barId);
  return {
    next_screen_id: "s_settings_saved",
    messages: [{ level: "info", text: "Settings saved." }],
  };
}
