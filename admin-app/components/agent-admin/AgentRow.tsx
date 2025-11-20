"use client";

import React from "react";

function Select({ value, onChange, options }: { value: string | null; onChange: (v: string | null) => void; options: string[] }) {
  return (
    <select className="border rounded p-1" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">(none)</option>
      {options.map((op) => (
        <option key={op} value={op}>{op}</option>
      ))}
    </select>
  );
}

export default function AgentRow({ agent }: { agent: { agent_type: string; primary_provider: string | null; fallback_provider: string | null; provider_config: any; is_active: boolean; updated_at?: string; updated_by?: string | null } }) {
  const [primary, setPrimary] = React.useState<string | null>(agent.primary_provider);
  const [fallback, setFallback] = React.useState<string | null>(agent.fallback_provider);
  const [openaiModel, setOpenaiModel] = React.useState<string>(agent.provider_config?.openai?.model ?? "gpt-4-turbo-preview");
  const [openaiTemp, setOpenaiTemp] = React.useState<number>(Number(agent.provider_config?.openai?.temperature ?? 0.7));
  const [openaiMax, setOpenaiMax] = React.useState<number>(Number(agent.provider_config?.openai?.max_tokens ?? 1000));
  const [geminiModel, setGeminiModel] = React.useState<string>(agent.provider_config?.gemini?.model ?? "gemini-1.5-flash");
  const [geminiTemp, setGeminiTemp] = React.useState<number>(Number(agent.provider_config?.gemini?.temperature ?? 0.7));
  const [geminiMax, setGeminiMax] = React.useState<number>(Number(agent.provider_config?.gemini?.max_tokens ?? 1000));
  const [active, setActive] = React.useState<boolean>(!!agent.is_active);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [message, setMessage] = React.useState<string>("");

  async function save() {
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/agent-admin/agents/${encodeURIComponent(agent.agent_type)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primary_provider: primary ?? undefined,
          fallback_provider: fallback ?? null,
          provider_config: {
            openai: { model: openaiModel, temperature: openaiTemp, max_tokens: openaiMax },
            gemini: { model: geminiModel, temperature: geminiTemp, max_tokens: geminiMax },
          },
          is_active: active,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: String(res.status) }));
        throw new Error(error || `http_${res.status}`);
      }
      setMessage("Saved");
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className="border p-2 font-mono">{agent.agent_type}</td>
      <td className="border p-2">
        <Select value={primary} onChange={setPrimary} options={["openai", "gemini"]} />
      </td>
      <td className="border p-2">
        <Select value={fallback} onChange={setFallback} options={["openai", "gemini"]} />
      </td>
      <td className="border p-2">
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded p-1 col-span-2" value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} />
          <input className="border rounded p-1" type="number" step="0.1" min={0} max={2} value={openaiTemp} onChange={(e) => setOpenaiTemp(Number(e.target.value))} title="Temperature" />
          <input className="border rounded p-1 col-span-3" type="number" min={1} value={openaiMax} onChange={(e) => setOpenaiMax(Number(e.target.value))} title="Max tokens" />
        </div>
      </td>
      <td className="border p-2">
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded p-1 col-span-2" value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} />
          <input className="border rounded p-1" type="number" step="0.1" min={0} max={2} value={geminiTemp} onChange={(e) => setGeminiTemp(Number(e.target.value))} title="Temperature" />
          <input className="border rounded p-1 col-span-3" type="number" min={1} value={geminiMax} onChange={(e) => setGeminiMax(Number(e.target.value))} title="Max tokens" />
        </div>
      </td>
      <td className="border p-2 text-center">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>
      <td className="border p-2 text-xs text-gray-600">
        {agent.updated_at ? new Date(agent.updated_at).toLocaleString() : "—"}
        {agent.updated_by ? ` · by ${agent.updated_by.slice(0, 8)}` : ""}
      </td>
      <td className="border p-2">
        <button className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        {message && <span className="ml-2 text-xs text-gray-600">{message}</span>}
      </td>
    </tr>
  );
}
