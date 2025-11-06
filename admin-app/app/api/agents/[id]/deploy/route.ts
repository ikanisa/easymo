import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { deployVersion } from "@/lib/agents/agents-service";
import { zodValidationError } from "@/lib/api/http";

const Body = z.object({ version: z.coerce.number().int().min(1) });

export const POST = createHandler("api.agents.deploy", async (req, _ctx, obs) => {
  const id = (obs.routeParams?.id as string) || (new URL(obs.requestUrl).pathname.split("/")[3] as string);
  const payload = await req.json().catch(() => ({}));
  try {
    const data = Body.parse(payload);
    return deployVersion(id, data);
  } catch (err) {
    return zodValidationError(err);
  }
});


export const runtime = "edge";
