"use client";

import { useEffect,useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { useAgentConfig, useUpdateAgentConfig } from "@/lib/queries/agent-orchestration";

interface AgentConfigDrawerProps {
  agentType: string;
  onClose: () => void;
}

export function AgentConfigDrawer({ agentType, onClose }: AgentConfigDrawerProps) {
  const { data, isLoading, error, refetch } = useAgentConfig(agentType);
  const updateConfig = useUpdateAgentConfig(agentType);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [slaMinutes, setSlaMinutes] = useState(5);
  const [maxExtensions, setMaxExtensions] = useState(2);
  const [fanOutLimit, setFanOutLimit] = useState(10);
  const [counterOfferDelta, setCounterOfferDelta] = useState(15);
  const [autoNegotiation, setAutoNegotiation] = useState(false);
  const [featureFlagScope, setFeatureFlagScope] = useState("disabled");
  const [systemPrompt, setSystemPrompt] = useState("");

  // Initialize form when data loads
  useEffect(() => {
    if (data?.agent) {
      setEnabled(data.agent.enabled);
      setSlaMinutes(data.agent.sla_minutes);
      setMaxExtensions(data.agent.max_extensions);
      setFanOutLimit(data.agent.fan_out_limit);
      setCounterOfferDelta(data.agent.counter_offer_delta_pct);
      setAutoNegotiation(data.agent.auto_negotiation);
      setFeatureFlagScope(data.agent.feature_flag_scope);
      setSystemPrompt(data.agent.system_prompt || "");
    }
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateConfig.mutateAsync({
        enabled,
        sla_minutes: slaMinutes,
        max_extensions: maxExtensions,
        fan_out_limit: fanOutLimit,
        counter_offer_delta_pct: counterOfferDelta,
        auto_negotiation: autoNegotiation,
        feature_flag_scope: featureFlagScope,
        system_prompt: systemPrompt || undefined,
      });
      refetch();
    } catch (error) {
      console.error("Failed to update agent config:", error);
    }
  };

  if (isLoading) {
    return (
      <Drawer title="Loading…" onClose={onClose}>
        <div className="text-center py-8 text-gray-600">Loading agent configuration…</div>
      </Drawer>
    );
  }

  if (error || !data?.agent) {
    return (
      <Drawer title="Error" onClose={onClose}>
        <div className="text-center py-8 text-red-600">
          We couldn’t load the agent configuration. Try again.
        </div>
      </Drawer>
    );
  }

  const agent = data.agent;

  return (
    <Drawer title={`Configure: ${agent.name}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Settings */}
        <div className="pb-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Basic settings</h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded"
                />
                Enable agent
              </label>
              <p className="text-xs text-gray-600 mt-1 ml-6">
                When disabled, the agent will not process any requests.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Agent type</label>
              <input
                type="text"
                value={agent.agent_type}
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={agent.description || ""}
                disabled
                rows={2}
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600"
              />
            </div>
          </div>
        </div>

        {/* SLA Policy */}
        <div className="pb-6 border-b">
          <h3 className="text-lg font-semibold mb-4">SLA policy</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                SLA minutes (deadline for session)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={slaMinutes}
                onChange={(e) => setSlaMinutes(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Time limit for the agent to complete its task (1–60 minutes).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max extensions</label>
              <input
                type="number"
                min={0}
                max={5}
                value={maxExtensions}
                onChange={(e) => setMaxExtensions(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Number of deadline extensions allowed (0–5).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vendor fan-out limit</label>
              <input
                type="number"
                min={1}
                max={50}
                value={fanOutLimit}
                onChange={(e) => setFanOutLimit(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Maximum number of vendors to contact simultaneously (1–50).
              </p>
            </div>
          </div>
        </div>

        {/* Negotiation Settings */}
        <div className="pb-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Negotiation settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Counter-offer delta (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={counterOfferDelta}
                onChange={(e) => setCounterOfferDelta(Number(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                Percentage adjustment for counter-offers (0–100%).
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={autoNegotiation}
                  onChange={(e) => setAutoNegotiation(e.target.checked)}
                  className="rounded"
                />
                Enable auto-negotiation
              </label>
              <p className="text-xs text-gray-600 mt-1 ml-6">
                Let the agent automatically negotiate with vendors.
              </p>
            </div>
          </div>
        </div>

        {/* Rollout Control */}
        <div className="pb-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Rollout control</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Feature flag scope</label>
            <select
              value={featureFlagScope}
              onChange={(e) => setFeatureFlagScope(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="disabled">Disabled</option>
              <option value="staging">Staging only</option>
              <option value="prod_10%">Production 10%</option>
              <option value="prod_50%">Production 50%</option>
              <option value="prod_100%">Production 100%</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">
              Choose which environment and percentage of customers see this agent.
            </p>
          </div>
        </div>

        {/* System Prompt */}
        <div className="pb-6 border-b">
          <h3 className="text-lg font-semibold mb-4">System prompt or persona</h3>
          <div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              placeholder="Enter the agent system prompt or persona instructions…"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs text-gray-600 mt-1">
              Defines how the agent should speak and behave.
            </p>
          </div>
        </div>

        {/* Tools Info (Read-only for now) */}
        <div className="pb-6">
          <h3 className="text-lg font-semibold mb-4">Enabled tools</h3>
          <div className="text-sm text-gray-600">
            {agent.enabled_tools?.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {agent.enabled_tools.map((tool: string, idx: number) => (
                  <li key={idx}>{tool}</li>
                ))}
              </ul>
            ) : (
              <p>No tools configured yet.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button type="submit" disabled={updateConfig.isPending}>
            {updateConfig.isPending ? "Saving…" : "Save configuration"}
          </Button>
          <Button type="button" onClick={onClose} variant="outline">
            Cancel
          </Button>
        </div>

        {/* Status Messages */}
        {updateConfig.isError && (
          <div className="text-sm text-red-600">We couldn’t save the configuration. Try again.</div>
        )}
        {updateConfig.isSuccess && (
          <div className="text-sm text-green-600">Updates saved.</div>
        )}
      </form>
    </Drawer>
  );
}
