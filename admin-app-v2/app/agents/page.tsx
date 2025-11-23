"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { AgentCard } from "@/components/features/agents/AgentCard";
import { ConfigPanel } from "@/components/features/agents/ConfigPanel";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { useState } from "react";

const mockAgents = [
  {
    id: "1",
    name: "Sales Assistant",
    description: "Handles initial customer inquiries and lead qualification.",
    status: "active" as const,
    type: "sales" as const,
    conversations: 1234,
  },
  {
    id: "2",
    name: "Support Bot",
    description: "Provides 24/7 technical support and troubleshooting.",
    status: "active" as const,
    type: "support" as const,
    conversations: 5678,
  },
  {
    id: "3",
    name: "Internal Helper",
    description: "Assists employees with HR and IT requests.",
    status: "paused" as const,
    type: "custom" as const,
    conversations: 456,
  },
];

export default function AgentsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    console.log("Toggle agent:", id);
  };

  const handleConfigure = (id: string) => {
    setSelectedAgentId(id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and configure your AI workforce.
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {mockAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={handleToggle}
                  onConfigure={handleConfigure}
                />
              ))}
            </div>
          </div>
          <div>
            {selectedAgentId ? (
              <ConfigPanel />
            ) : (
              <div className="rounded-lg border border-dashed p-12 text-center text-gray-500">
                Select an agent to configure
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
