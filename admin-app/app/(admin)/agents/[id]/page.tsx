import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

async function fetchAgentDetail(id: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("supabase_unavailable");
  }

  const { data: persona, error } = await supabase
    .from("agent_personas")
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!persona) {
    return null;
  }

  const [{ data: versions }, { data: deployments }] = await Promise.all([
    supabase
      .from("agent_versions")
      .select("id,version_no,created_at,created_by,updated_at")
      .eq("persona_id", id)
      .order("version_no", { ascending: false }),
    supabase
      .from("agent_deployments")
      .select("id,environment,status,created_at,created_by,version_id")
      .eq("persona_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return { persona, versions: versions ?? [], deployments: deployments ?? [] };
}

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const detail = await fetchAgentDetail(params.id);
  if (!detail) {
    notFound();
  }

  const { persona, versions, deployments } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{persona.name}</h1>
          <p className="text-sm text-slate-600">Slug: {persona.slug}</p>
        </div>
        <Link
          href="/agents"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Back to agents
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Summary</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="text-sm text-slate-800">{persona.status}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
            <dd className="text-sm text-slate-800">{new Date(persona.updated_at).toLocaleString()}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Description</dt>
            <dd className="text-sm text-slate-800">{persona.description ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Versions</h2>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No versions published yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {versions.map((version) => (
              <li key={version.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Version {version.version_no}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Created by {version.created_by ?? "unknown"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Deployments</h2>
        {deployments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No deployments recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {deployments.map((deployment) => (
              <li key={deployment.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>
                    {deployment.environment} · {deployment.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(deployment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Version {deployment.version_id}</p>
                {deployment.notes && (
                  <p className="mt-1 text-xs text-slate-600">{deployment.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
