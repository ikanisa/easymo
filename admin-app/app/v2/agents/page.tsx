"use client";

import { useState, useMemo } from "react";
import { DataTable } from "@/src/v2/components/ui/DataTable";
import { SearchBar } from "@/src/v2/components/ui/SearchBar";
import { useAgents } from "@/src/v2/lib/supabase/hooks";
import { AgentDetailsModal } from "@/src/v2/components/agents/AgentDetailsModal";
import type { AgentRow } from "@/src/v2/lib/supabase/database.types";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@heroicons/react/24/outline";

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) {
      return agents;
    }

    return agents.filter((agent) => {
      const normalizedTerm = searchTerm.toLowerCase();
      return (
        agent.name.toLowerCase().includes(normalizedTerm) ||
        agent.phone.toLowerCase().includes(normalizedTerm)
      );
    });
  }, [agents, searchTerm]);

  const columns = [
    {
      key: "name" as const,
      label: "Name",
      sortable: true,
    },
    {
      key: "phone" as const,
      label: "Phone",
      sortable: true,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (value: AgentRow["status"]) => (
        <span
          className={
            value === "active"
              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
              : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800"
          }
        >
          {value}
        </span>
      ),
    },
    {
      key: "created_at" as const,
      label: "Joined",
      render: (value: AgentRow["created_at"]) => new Date(value).toLocaleDateString(),
    },
    {
      key: "wallet_balance" as const,
      label: "Balance",
      render: (value: AgentRow["wallet_balance"]) => `$${Number(value ?? 0).toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your agent network</p>
        </div>
        <Button variant="primary">
          <PlusIcon className="mr-2 h-5 w-5" />
          Add Agent
        </Button>
      </div>

      <div className="flex gap-4">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search agents..."
          className="max-w-md"
        />
      </div>

      <DataTable
        data={filteredAgents}
        columns={columns}
        loading={isLoading}
        onRowClick={setSelectedAgent}
      />

      {selectedAgent && (
        <AgentDetailsModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
