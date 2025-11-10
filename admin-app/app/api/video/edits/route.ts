import { NextResponse } from "next/server";
import {
  appendLineage,
  applyMutation,
  type Mutation,
  type ShotPlan,
} from "@easymo/video-agent-schema";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

interface EditRequestBody {
  parentPlan: ShotPlan;
  mutation: Mutation;
  languages?: string[];
}

function mutatePlan(parent: ShotPlan, mutation: Mutation): ShotPlan {
  const mutated = applyMutation(parent, mutation);
  const lineageEntry = {
    id: crypto.randomUUID(),
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

async function fallbackOrchestrate(
  plan: ShotPlan,
  languages: string[],
) {
  const orchestratorUrl = process.env.VIDEO_ORCHESTRATOR_URL;
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
    throw new Error(`Orchestrator request failed: ${await response.text()}`);
  }
  return response.json();
}

export async function POST(request: Request) {
  const body = (await request.json()) as EditRequestBody;
  if (!body.parentPlan || !body.mutation) {
    return NextResponse.json(
      { ok: false, error: "missing_payload" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.functions.invoke("edits", {
      body,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  }

  try {
    const childPlan = mutatePlan(body.parentPlan, body.mutation);
    const result = await fallbackOrchestrate(childPlan, body.languages ?? []);
    return NextResponse.json({
      ok: true,
      data: { parent: body.parentPlan, child: childPlan, result },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
