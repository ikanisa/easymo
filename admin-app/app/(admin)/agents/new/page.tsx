"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAgent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = data.get('name');
    const summary = data.get('summary');
    const res = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name, summary }) });
    if (res.ok) {
      const json = await res.json();
      router.push(`/agents/${json.agent.id}`);
    } else {
      setLoading(false);
    }
  }
  return (
    <div className="p-6 space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">New Agent</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm">Name</span>
          <input name="name" required className="border rounded px-3 py-2" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Summary</span>
          <textarea name="summary" className="border rounded px-3 py-2" />
        </label>
        <div>
          <button disabled={loading} className="px-3 py-2 bg-black text-white rounded">{loading ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

