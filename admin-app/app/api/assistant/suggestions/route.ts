import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";

const Body = z.object({
  text: z.string().min(1),
  agentId: z.string().uuid().optional(),
});

export const POST = createHandler("api.assistant.suggestions", async (req) => {
  const payload = await req.json().catch(() => ({}));
  try {
    const data = Body.parse(payload);
    // Placeholder suggestions; in future call Agent-Core suggestions endpoint
    const base = data.text.trim();
    const suggestions = [
      `Summarize: ${base.slice(0, 40)}`,
      `Next step?`,
      `Any blockers?`,
    ];
    return jsonOk({ suggestions });
  } catch (err) {
    return zodValidationError(err);
  }
});
