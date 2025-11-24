import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { recordAdminAudit } from "./audit.ts";

export async function handleAdminPlaceholder(
  req: FlowExchangeRequest,
  ctx: { waId: string },
  area: string,
): Promise<FlowExchangeResponse> {
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: `admin_${area}_placeholder`,
    targetId: req.action_id ?? null,
  });
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: `${area} actions coming soon.` }],
  };
}
