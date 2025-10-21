"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AgentCreator() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug.trim() || undefined, description }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error ?? "Failed to create agent");
        return;
      }
      setName("");
      setSlug("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded-lg p-4 bg-white shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Create New Agent Persona</h2>
        <p className="text-sm text-slate-500">
          Define a new AI agent persona with optional slug and description. Additional configuration can be added after creation.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col text-sm font-medium">
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Broker Assistant"
            required
          />
        </label>
        <label className="flex flex-col text-sm font-medium">
          Slug
          <input
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="broker-assistant"
          />
        </label>
      </div>
      <label className="flex flex-col text-sm font-medium">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Handles insurance intake over WhatsApp, triages documents, and prepares back-office packages."
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create Agent"}
        </button>
      </div>
    </form>
  );
}
