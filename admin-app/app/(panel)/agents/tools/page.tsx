"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { useAgentTools, useTestAgentTool, useUpdateAgentTool } from "@/lib/queries/agent-tools";

export default function AgentToolsPage() {
  const { pushToast } = useToast();
  const toolsQuery = useAgentTools();
  const updateTool = useUpdateAgentTool();
  const testCall = useTestAgentTool();
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [payloadDraft, setPayloadDraft] = useState<string>("{\n  \"example\": \"payload\"\n}");
  const [testResult, setTestResult] = useState<unknown>(null);

  const tools = useMemo(() => {
    const list = (toolsQuery.data?.tools as any[] | undefined) ?? [];
    return list;
  }, [toolsQuery.data?.tools]);

  useEffect(() => {
    if (!selectedToolId && tools.length) {
      setSelectedToolId(tools[0]?.id ?? null);
    }
  }, [tools, selectedToolId]);

  const selectedTool = tools.find((tool) => tool.id === selectedToolId) ?? null;

  const handleToggle = async (toolId: string, current: boolean) => {
    try {
      await updateTool.mutateAsync({ toolId, data: { enabled: !current } });
      pushToast(!current ? "Tool enabled" : "Tool disabled", "success");
    } catch (error) {
      pushToast(
        `Update failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  const handleCopyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast("Copied to clipboard", "success");
    } catch {
      pushToast("Copy failed", "error");
    }
  };

  const handleTestCall = async () => {
    if (!selectedToolId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payloadDraft || "{}");
    } catch (error) {
      pushToast("Payload must be valid JSON", "error");
      return;
    }

    try {
      const result = await testCall.mutateAsync({ toolId: selectedToolId, payload: parsed });
      setTestResult(result?.result ?? result);
      const status = (result as any)?.result?.status;
      pushToast(
        status ? `Test call ${status === "ok" ? "succeeded" : status}` : "Test call completed",
        status === "error" ? "error" : "success",
      );
    } catch (error) {
      pushToast(
        `Test call failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="Tools registry"
        description="Toggle integrations, inspect schema definitions, and send test payloads through the agent tool proxy."
      />

      <SectionCard
        title="Registered tools"
        description="Each tool maps to an Agent-Core capability or Supabase function invoked during runs."
      >
        {toolsQuery.isLoading ? (
          <div className="text-sm text-[color:var(--color-muted)]">Loading tools…</div>
        ) : tools.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <tr className="text-left">
                  <th className="px-3 py-2">Tool</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Parameters</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Key</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} className="border-b last:border-none">
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={`text-left text-sm font-medium ${
                            selectedToolId === tool.id ? "text-[color:var(--color-foreground)]" : "text-[color:var(--color-muted)]"
                          }`}
                          onClick={() => setSelectedToolId(tool.id)}
                        >
                          {tool.name}
                        </button>
                        <Badge variant={tool.enabled ? "green" : "red"}>
                          {tool.enabled ? "enabled" : "disabled"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                        Updated {new Date(tool.updated_at).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top text-sm text-[color:var(--color-foreground)]">
                      {tool.description}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-[color:var(--color-muted)]">
                      <pre className="max-h-32 overflow-y-auto rounded bg-white/70 p-2">
                        {JSON.stringify(tool.parameters ?? {}, null, 2)}
                      </pre>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <label className="inline-flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                        <input
                          type="checkbox"
                          checked={Boolean(tool.enabled)}
                          onChange={() => handleToggle(tool.id, Boolean(tool.enabled))}
                          className="h-4 w-4 rounded border-[color:var(--color-border)]"
                        />
                        Toggle
                      </label>
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-white/70 px-2 py-1">{tool.id}</code>
                        <button
                          type="button"
                          className="text-[color:var(--color-muted)] underline"
                          onClick={() => handleCopyKey(tool.id)}
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-[color:var(--color-muted)]">No tools found.</div>
        )}
        {toolsQuery.data?.integration ? (
          <p className="mt-4 text-xs text-yellow-600">
            {toolsQuery.data.integration.message}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Test call sandbox"
        description="Send a payload through the selected tool endpoint to verify connectivity and proxy behaviour."
      >
        {selectedTool ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-[color:var(--color-foreground)]">
                  {selectedTool.name}
                </h3>
                <p className="text-xs text-[color:var(--color-muted)]">
                  Endpoint metadata: {JSON.stringify(selectedTool.metadata ?? {}, null, 2)}
                </p>
              </div>
              <textarea
                value={payloadDraft}
                onChange={(event) => setPayloadDraft(event.target.value)}
                className="h-48 w-full rounded-lg border border-[color:var(--color-border)]/60 bg-white p-3 font-mono text-xs"
              />
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition hover:bg-black/80 md:w-auto"
                onClick={handleTestCall}
                disabled={testCall.isPending}
              >
                {testCall.isPending ? "Calling…" : "Send test call"}
              </button>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[color:var(--color-foreground)]">Response</h3>
              <pre className="min-h-[12rem] rounded-lg border border-[color:var(--color-border)]/60 bg-white/80 p-3 text-xs text-[color:var(--color-foreground)]">
                {testResult ? JSON.stringify(testResult, null, 2) : "Awaiting invocation"}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[color:var(--color-muted)]">
            Select a tool from the registry to begin testing.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
