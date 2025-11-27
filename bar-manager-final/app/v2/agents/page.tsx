"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { CrudDialog } from "@/src/v2/components/ui/CrudDialog";
import { DataTable, type DataTableColumn } from "@/src/v2/components/ui/DataTable";
import { SearchBar } from "@/src/v2/components/ui/SearchBar";
import {
  type Agent,
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
} from "@/src/v2/lib/supabase/hooks";

interface AgentFormValues {
  name: string;
  phone: string;
  status: string;
  wallet_balance: number;
}

type DialogState =
  | { mode: "create"; agent: null }
  | { mode: "edit"; agent: Agent }
  | null;

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useAgents();
  const { pushToast } = useToast();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const undoBuffer = useRef<Agent | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) {
      return agents;
    }

    return agents.filter((agent) => {
      const normalizedTerm = searchTerm.toLowerCase();
      const name = (agent.name ?? "").toLowerCase();
      const phone = (agent.phone ?? "").toLowerCase();
      return name.includes(normalizedTerm) || phone.includes(normalizedTerm);
    });
  }, [agents, searchTerm]);

  const columns: DataTableColumn<Agent>[] = [
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
      render: (_value, item) => {
        const value = item.status ?? "inactive";
        return (
        <span
          className={
            value === "active"
              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
              : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800"
          }
        >
          {value}
        </span>
      );
      },
    },
    {
      key: "created_at" as const,
      label: "Joined",
      render: (_value, item) => new Date(item.created_at).toLocaleDateString(),
    },
    {
      key: "wallet_balance" as const,
      label: "Balance",
      render: (_value, item) => `$${Number(item.wallet_balance ?? 0).toFixed(2)}`,
    },
  ];

  const openCreateDialog = () => setDialogState({ mode: "create", agent: null });
  const openEditDialog = (agent: Agent) => setDialogState({ mode: "edit", agent });
  const closeDialog = () => setDialogState(null);

  const initialValues: AgentFormValues = dialogState?.mode === "edit" && dialogState.agent
    ? {
        name: dialogState.agent.name ?? "",
        phone: dialogState.agent.phone ?? "",
        status: dialogState.agent.status ?? "active",
        wallet_balance: Number(dialogState.agent.wallet_balance ?? 0),
      }
    : {
        name: "",
        phone: "",
        status: "active",
        wallet_balance: 0,
      };

  const handleSubmit = async (values: AgentFormValues) => {
    try {
      if (dialogState?.mode === "edit" && dialogState.agent) {
        await updateAgent.mutateAsync({
          id: dialogState.agent.id,
          name: values.name,
          phone: values.phone,
          status: values.status,
          wallet_balance: values.wallet_balance,
        });
        pushToast("Agent updated.", "success");
      } else {
        await createAgent.mutateAsync({
          name: values.name,
          phone: values.phone,
          status: values.status,
          wallet_balance: values.wallet_balance,
        });
        pushToast("Agent created.", "success");
      }
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "We couldn’t save the agent.",
        "error",
      );
    }
  };

  const handleDelete = async () => {
    if (dialogState?.mode !== "edit" || !dialogState.agent) return;
    try {
      const deleted = await deleteAgent.mutateAsync({ id: dialogState.agent.id });
      undoBuffer.current = deleted;
      pushToast(`Deleted ${deleted.name}.`, {
        variant: "success",
        actionLabel: "Undo",
        onAction: async () => {
          const payload = undoBuffer.current;
          if (!payload) return;
          try {
            await createAgent.mutateAsync({
              id: payload.id,
              name: payload.name ?? "",
              phone: payload.phone ?? "",
              status: payload.status ?? "active",
              wallet_balance: Number(payload.wallet_balance ?? 0),
            });
            pushToast("Restored agent.", "success");
          } catch (error) {
            pushToast(
              error instanceof Error
                ? error.message
                : "Unable to undo deletion.",
              "error",
            );
          }
        },
      });
      closeDialog();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Failed to delete agent.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your agent network</p>
        </div>
        <Button variant="primary" onClick={openCreateDialog}>
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
        onRowClick={openEditDialog}
      />

      {dialogState ? (
        <CrudDialog
          open={Boolean(dialogState)}
          mode={dialogState.mode}
          entityName="agent"
          initialValues={initialValues}
          onClose={closeDialog}
          onSubmit={handleSubmit}
          onDelete={dialogState.mode === "edit" ? handleDelete : undefined}
          description="Keep phone numbers formatted with country codes so SMS notifications work without manual edits."
          renderFields={({ values, onChange }) => (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="agent-name">
                  Name
                </label>
                <Input
                  id="agent-name"
                  value={values.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="agent-phone">
                  Phone
                </label>
                <Input
                  id="agent-phone"
                  value={values.phone}
                  onChange={(event) => onChange({ phone: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="agent-status">
                  Status
                </label>
                <select
                  id="agent-status"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={values.status}
                  onChange={(event) => onChange({ status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="agent-balance">
                  Wallet balance
                </label>
                <Input
                  id="agent-balance"
                  type="number"
                  step="0.01"
                  value={values.wallet_balance}
                  onChange={(event) =>
                    onChange({ wallet_balance: Number(event.target.value ?? 0) })
                  }
                  min={0}
                />
              </div>
            </>
          )}
        />
      ) : null}
    </div>
  );
}
