import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";

const Body = z.object({ text: z.string().min(1), promptId: z.string().optional().default("freeform.query"), agentId: z.string().uuid().optional() });

export const POST = createHandler("api.assistant.suggestions", async (req) => {
  const payload = await req.json().catch(() => ({}));
  try {
    const data = Body.parse(payload);
    const now = new Date().toISOString();
    const id = Math.random().toString(36).slice(2);
    const suggestion = {
      id: `sugg-${id}`,
      title: "Quick Suggestions",
      summary: "Suggested next actions based on your input.",
      generatedAt: now,
      actions: [
        { id: "apply", title: "Apply", type: "primary" },
        { id: "dismiss", title: "Dismiss", type: "secondary" },
      ],
      references: [],
      limitations: ["Preview suggestions only"],
    };
    const messages = [
      { id: `m-user-${id}`, role: "user" as const, content: data.text, createdAt: now },
      { id: `m-assistant-${id}`, role: "assistant" as const, content: "Here are some suggestions to proceed.", createdAt: now },
    ];
    return jsonOk({ promptId: data.promptId, suggestion, messages });
  } catch (err) {
    return zodValidationError(err);
  }
});

export const runtime = "nodejs";
