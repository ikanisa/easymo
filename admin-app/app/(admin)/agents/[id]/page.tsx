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

      <section className="space-y-3">
        <h2 className="font-medium">Documents</h2>
        <UploadDocument agentId={id} />
        <AgentDocuments id={id} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Tasks</h2>
        <NewTask agentId={id} />
        <AgentTasks id={id} />
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
        <VersionRow key={v.id} agentId={id} v={v} onPublish={() => publish(v.id)} />
      ))}
      {versions.length === 0 && <div className="text-gray-600">No versions.</div>}
    </div>
  );
}

function VersionRow({ v, agentId, onPublish }: { v: any; agentId: string; onPublish: () => Promise<void> }) {
  const { mutate } = useSWR(`/api/agents/${agentId}/versions`, (url) => fetch(url).then(r => r.json()));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const instructions = String(data.get('instructions') || '');
    const toolsRaw = String(data.get('tools') || '{}');
    let tools: any = {};
    try { tools = JSON.parse(toolsRaw || '{}'); } catch { tools = {}; }
    await fetch(`/api/agents/${agentId}/versions/${v.id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ instructions, tools }) });
    await mutate();
  }
  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Version {v.version}</div>
        {!v.published && <button onClick={onPublish} className="px-2 py-1 text-sm border rounded">Publish</button>}
      </div>
      <form onSubmit={save} className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Instructions</span>
          <textarea name="instructions" defaultValue={v.instructions || ''} className="border rounded px-2 py-1 min-h-[80px]" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Tools (JSON)</span>
          <textarea name="tools" defaultValue={JSON.stringify(v.tools || {}, null, 2)} className="border rounded px-2 py-1 font-mono min-h-[80px]" />
        </label>
        <div>
          <button className="px-2 py-1 text-sm bg-black text-white rounded">Save Version</button>
        </div>
      </form>
    </div>
  );
}

function AgentDocuments({ id }: { id: string }) {
  const { data } = useSWR(`/api/agents/${id}/documents`, (url) => fetch(url).then(r => r.json()));
  const docs = data?.documents ?? [];
  return (
    <div className="grid gap-2">
      {docs.map((d: any) => (
        <div key={d.id} className="border rounded p-3 flex items-center justify-between">
          <div>
            <div className="font-medium">{d.title}</div>
            <div className="text-xs text-gray-500">{d.storage_path} • {d.embedding_status}</div>
          </div>
        </div>
      ))}
      {docs.length === 0 && <div className="text-gray-600">No documents.</div>}
    </div>
  );
}

function UploadDocument({ agentId }: { agentId: string }) {
  const { mutate } = useSWR(`/api/agents/${agentId}/documents`, (url) => fetch(url).then(r => r.json()));
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const res = await fetch(`/api/agents/${agentId}/documents/upload`, { method: 'POST', body: data });
    if (res.ok) await mutate();
    (form as any).reset();
  }
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="text" name="title" placeholder="Title (optional)" className="border rounded px-2 py-1" />
      <input type="file" name="file" required className="border rounded px-2 py-1" />
      <button className="px-2 py-1 border rounded">Upload</button>
    </form>
  );
}

function AgentTasks({ id }: { id: string }) {
  const { data } = useSWR(`/api/agents/${id}/tasks`, (url) => fetch(url).then(r => r.json()));
  const tasks = data?.tasks ?? [];
  return (
    <div className="grid gap-2">
      {tasks.map((t: any) => (
        <div key={t.id} className="border rounded p-3">
          <div className="font-medium">{t.title}</div>
          <div className="text-xs text-gray-500">{t.status} • {new Date(t.created_at).toLocaleString()}</div>
        </div>
      ))}
      {tasks.length === 0 && <div className="text-gray-600">No tasks.</div>}
    </div>
  );
}

function NewTask({ agentId }: { agentId: string }) {
  const { mutate } = useSWR(`/api/agents/${agentId}/tasks`, (url) => fetch(url).then(r => r.json()));
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = data.get('title');
    if (!title) return;
    await fetch(`/api/agents/${agentId}/tasks`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ title }) });
    await mutate();
    (form as any).reset();
  }
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="text" name="title" placeholder="Task title" required className="border rounded px-2 py-1" />
      <button className="px-2 py-1 border rounded">Add Task</button>
    </form>
  );
}
