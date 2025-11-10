import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { deployVersion } from "@/lib/agents/agents-service";
import { zodValidationError } from "@/lib/api/http";

const Body = z.object({ version: z.coerce.number().int().min(1) });

type RouteContext = { params: { id: string } };

export const POST = createHandler<RouteContext>("api.agents.deploy", async (req, ctx, _obs) => {
  const url = new URL(req.url);
  const id = ctx?.params?.id ?? url.pathname.split("/")[3] ?? "";
  const payload = await req.json().catch(() => ({}));
  try {
    const data = Body.parse(payload);
    return deployVersion(id, data);
  } catch (err) {
    return zodValidationError(err);
  }
});


export const runtime = "nodejs";
