"use client";
import { useState } from "react";

export default function MemoryPage() {
  const [userId, setUserId] = useState("");
  const [key, setKey] = useState("preference");
  const [value, setValue] = useState("{ \"likes\": [\"live music\"] }");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function upsert() {
    setError(null);
    setResult("");
    setLoading(true);
    try {
      const res = await fetch("/api/memory/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, key, value: JSON.parse(value) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "upsert failed");
      setResult("Upsert OK");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function touch() {
    setError(null);
    setResult("");
    setLoading(true);
    try {
      const res = await fetch("/api/memory/sessions/touch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "touch failed");
      setResult("Session touched");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Assistant Memory (Admin)</h1>
      <div className="grid gap-3 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm">User ID</span>
          <input className="border p-2 rounded" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Key</span>
          <input className="border p-2 rounded" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Value (JSON)</span>
          <textarea className="border p-2 rounded min-h-[120px]" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button disabled={loading} onClick={upsert} className="bg-black text-white px-4 py-2 rounded">Upsert Memory</button>
          <button disabled={loading} onClick={touch} className="bg-gray-800 text-white px-4 py-2 rounded">Touch Session</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {result && <div className="text-sm text-green-600">{result}</div>}
      </div>
    </div>
  );
}

