"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  personaId: string;
};

export function AgentVersionForm({ personaId }: Props) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [toolsJson, setToolsJson] = useState("[]");
  const [memoryJson, setMemoryJson] = useState("{}");
  const [evaluationJson, setEvaluationJson] = useState("[]");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    let tools: unknown;
    let memory: unknown;
    let evaluation: unknown;

    try {
      tools = toolsJson.trim() ? JSON.parse(toolsJson) : [];
    } catch (err) {
      setError(`Tools JSON invalid: ${(err as Error).message}`);
      return;
    }

    try {
      memory = memoryJson.trim() ? JSON.parse(memoryJson) : {};
    } catch (err) {
      setError(`Memory config JSON invalid: ${(err as Error).message}`);
      return;
    }

    try {
      evaluation = evaluationJson.trim() ? JSON.parse(evaluationJson) : [];
    } catch (err) {
      setError(`Evaluation plan JSON invalid: ${(err as Error).message}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/agents/${personaId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions,
          tools,
          memory_config: memory,
          evaluation_plan: evaluation,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error ?? "Failed to create version");
        return;
      }

      setInstructions("");
      setToolsJson("[]");
      setMemoryJson("{}");
      setEvaluationJson("[]");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Publish new version</h3>
        <p className="text-sm text-slate-500">Provide updated instructions and optional tool configuration. Versions are automatically numbered.</p>
      </div>
      <label className="flex flex-col text-sm font-medium">
        Instructions
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          rows={6}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Detailed system instructions for the agent persona."
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        Tools JSON
        <textarea
          value={toolsJson}
          onChange={(event) => setToolsJson(event.target.value)}
          rows={3}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        Memory Config JSON
        <textarea
          value={memoryJson}
          onChange={(event) => setMemoryJson(event.target.value)}
          rows={2}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </label>
      <label className="flex flex-col text-sm font-medium">
        Evaluation Plan JSON
        <textarea
          value={evaluationJson}
          onChange={(event) => setEvaluationJson(event.target.value)}
          rows={2}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Publishing…" : "Publish version"}
        </button>
      </div>
    </form>
  );
}
