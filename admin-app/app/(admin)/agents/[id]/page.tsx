"use client";
import useSWR from "swr";
import { useRouter } from "next/navigation";

export default function AgentDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { data, mutate } = useSWR(`/api/agents/${id}`, (url) => fetch(url).then(r => r.json()));
  const agent = data?.agent;
  if (!agent) return <div className="p-4">Loading…</div>;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    await fetch(`/api/agents/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    await mutate();
  }

  async function addVersion() {
    await fetch(`/api/agents/${id}/versions`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ instructions: '', tools: {} }) });
    router.refresh();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Agent: {agent.name}</h1>
      <form onSubmit={save} className="grid gap-3 max-w-2xl">
        <label className="grid gap-1">
          <span className="text-sm">Name</span>
          <input name="name" defaultValue={agent.name} className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Summary</span>
          <textarea name="summary" defaultValue={agent.summary || ''} className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Default Language</span>
          <input name="default_language" defaultValue={agent.default_language || 'en'} className="border rounded px-3 py-2" />
        </label>
        <div>
          <button className="px-3 py-2 bg-black text-white rounded">Save</button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Versions</h2>
          <button onClick={addVersion} className="px-3 py-2 border rounded">New Version</button>
        </div>
        <AgentVersions id={id} />
      </section>
    </div>
  );
}

function AgentVersions({ id }: { id: string }) {
  const { data, mutate } = useSWR(`/api/agents/${id}/versions`, (url) => fetch(url).then(r => r.json()));
  const versions = data?.versions ?? [];
  async function publish(versionId: string) {
    await fetch(`/api/agents/${id}/versions/${versionId}/publish`, { method: 'POST' });
    await mutate();
  }
  return (
    <div className="grid gap-2">
      {versions.map((v: any) => (
        <div key={v.id} className="border rounded p-3 flex items-center justify-between">
          <div>
            <div className="font-medium">Version {v.version}</div>
            <div className="text-xs text-gray-500">{v.published ? 'published' : 'draft'} • {new Date(v.created_at).toLocaleString()}</div>
          </div>
          {!v.published && <button onClick={() => publish(v.id)} className="px-2 py-1 text-sm border rounded">Publish</button>}
        </div>
      ))}
      {versions.length === 0 && <div className="text-gray-600">No versions.</div>}
    </div>
  );
}

