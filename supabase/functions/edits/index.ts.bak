import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { v4 as uuid } from "https://esm.sh/uuid@9.0.1";
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
} from "../_shared/http.ts";
import {
  appendLineage,
  applyMutation,
  type LineageEntry,
  type Mutation,
  type ShotPlan,
} from "../../packages/video-agent-schema/_src/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization",
};

interface EditRequestBody {
  parentPlan: ShotPlan;
  mutation: Mutation;
  languages?: string[];
}
 
function mutatePlan(parent: ShotPlan, mutation: Mutation): ShotPlan {
  const mutated = applyMutation(parent, mutation);
  const lineageEntry: LineageEntry = {
    id: uuid(),
    parentId: parent.id,
    mutation,
    timestamp: new Date().toISOString(),
  };
  const withLineage = appendLineage(mutated, lineageEntry);
  return {
    ...withLineage,
    id: `${parent.id}-edit-${lineageEntry.id}`,
    outputPath: parent.outputPath.replace(
      /\.mp4$/i,
      `-edit-${lineageEntry.id}.mp4`,
    ),
  };
}

async function forwardToOrchestrator(plan: ShotPlan, languages: string[]) {
  const orchestratorUrl = Deno.env.get("VIDEO_ORCHESTRATOR_URL");
  if (!orchestratorUrl) {
    throw new Error("VIDEO_ORCHESTRATOR_URL is not configured");
  }
  const response = await fetch(`${orchestratorUrl}/render`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ plan, options: { languages } }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Orchestrator rejected edit: ${text}`);
  }
  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(["POST"], { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EditRequestBody;
    if (!body.parentPlan || !body.mutation) {
      return badRequest("missing_payload", { headers: corsHeaders });
    }
    const childPlan = mutatePlan(body.parentPlan, body.mutation);
    const orchestratorResponse = await forwardToOrchestrator(
      childPlan,
      body.languages ?? [],
    );
    return ok(
      {
        parent: body.parentPlan,
        child: childPlan,
        result: orchestratorResponse,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(error);
    return serverError(
      "edit_failed",
      {
        reason: error instanceof Error ? error.message : String(error),
      },
      { headers: corsHeaders },
    );
  }
});
