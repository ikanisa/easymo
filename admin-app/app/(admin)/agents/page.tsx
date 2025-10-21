import { fetchAgentPersonas } from "@/lib/server/agents";
import { AgentCreator } from "@/components/agents/AgentCreator";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const personas = await fetchAgentPersonas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">AI Agents</h1>
        <p className="text-sm text-slate-600">
          Manage agent personas, review their status, and prepare deployments. Use the creation form to add a new persona before configuring prompts, documents, and tool access.
        </p>
      </div>

      <AgentCreator />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Slug</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Last Updated</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {personas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No agent personas defined yet. Create one to begin configuring prompts, documents, and deployments.
                </td>
              </tr>
            ) : (
              personas.map((persona) => (
                <tr key={persona.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    <a href={`/agents/${persona.id}`} className="hover:text-slate-700 hover:underline">
                      {persona.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{persona.slug}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        persona.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : persona.status === "archived"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {persona.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(persona.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {persona.description ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
