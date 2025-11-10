"use client";

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { Drawer } from "@/components/ui/Drawer";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { OmniSearchResult, OmniSearchCategory } from "@/lib/omnisearch/types";
import type { SidecarTab } from "@/components/layout/PanelContext";

interface AgentSidecarProps {
  open: boolean;
  entity: OmniSearchResult | null;
  tab: SidecarTab;
  onClose: () => void;
  onTabChange: (tab: SidecarTab) => void;
}

const TAB_LABELS: Record<SidecarTab, string> = {
  overview: "Overview",
  logs: "Logs",
  tasks: "Tasks",
  policies: "Policies",
};

const CATEGORY_TABS: Record<OmniSearchCategory, SidecarTab[]> = {
  agent: ["overview", "logs", "tasks", "policies"],
  request: ["logs", "tasks"],
  policy: ["policies"],
  task: ["tasks"],
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function renderJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AgentSidecar({ open, entity, tab, onClose, onTabChange }: AgentSidecarProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentOverview, setAgentOverview] = useState<any | null>(null);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [agentTasks, setAgentTasks] = useState<any[]>([]);
  const [policyEntries, setPolicyEntries] = useState<any[]>([]);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [taskDetail, setTaskDetail] = useState<any | null>(null);

  useEffect(() => {
    setAgentOverview(null);
    setAgentLogs([]);
    setAgentTasks([]);
    setPolicyEntries([]);
    setSessionDetail(null);
    setTaskDetail(null);
    setError(null);
  }, [entity]);

  const allowedTabs = useMemo<SidecarTab[]>(() => {
    if (!entity) return [];
    return CATEGORY_TABS[entity.category] ?? ["overview"];
  }, [entity]);

  useEffect(() => {
    if (!entity || allowedTabs.length === 0) return;
    if (!allowedTabs.includes(tab)) {
      onTabChange(allowedTabs[0]);
    }
  }, [allowedTabs, entity, onTabChange, tab]);

  useEffect(() => {
    if (!open || !entity || !supabase) return;

    let cancelled = false;
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        if (entity.category === "agent") {
          if (tab === "overview") {
            const response = await supabase
              .from("agent_registry")
              .select("id, agent_type, name, description, enabled, sla_minutes, updated_at")
              .eq("id", entity.id)
              .maybeSingle();
            if (cancelled) return;
            if (response.error) throw response.error;
            setAgentOverview(response.data ?? null);
          } else if (tab === "logs") {
            const response = await supabase
              .from("agent_sessions")
              .select("id, status, agent_type, started_at, deadline_at, completed_at")
              .eq("agent_type", entity.agentType)
              .order("started_at", { ascending: false })
              .limit(20);
            if (cancelled) return;
            if (response.error) throw response.error;
            setAgentLogs(response.data ?? []);
          } else if (tab === "tasks") {
            const response = await supabase
              .from("agent_tasks")
              .select("id, status, title, due_at, created_at")
              .eq("agent_id", entity.personaId ?? entity.id)
              .order("created_at", { ascending: false })
              .limit(20);
            if (cancelled) return;
            if (response.error) throw response.error;
            setAgentTasks(response.data ?? []);
          } else if (tab === "policies") {
            const response = await supabase
              .from("settings")
              .select("key, value, updated_at")
              .ilike("key", "%policy%")
              .order("updated_at", { ascending: false })
              .limit(20);
            if (cancelled) return;
            if (response.error) throw response.error;
            setPolicyEntries(response.data ?? []);
          }
        } else if (entity.category === "request") {
          if (tab === "logs") {
            const response = await supabase
              .from("agent_sessions")
              .select("id, status, agent_type, started_at, deadline_at, completed_at, request_data")
              .eq("id", entity.id)
              .maybeSingle();
            if (cancelled) return;
            if (response.error) throw response.error;
            setSessionDetail(response.data ?? null);
          } else if (tab === "tasks") {
            // Tasks for specific session require metadata; surface an empty list gracefully
            setAgentTasks([]);
          }
        } else if (entity.category === "policy") {
          const response = await supabase
            .from("settings")
            .select("key, value, updated_at")
            .eq("key", entity.id)
            .maybeSingle();
          if (cancelled) return;
          if (response.error) throw response.error;
          setPolicyEntries(response.data ? [response.data] : []);
        } else if (entity.category === "task") {
          const response = await supabase
            .from("agent_tasks")
            .select("id, status, title, payload, due_at, created_at, assigned_to, created_by")
            .eq("id", entity.id)
            .maybeSingle();
          if (cancelled) return;
          if (response.error) throw response.error;
          setTaskDetail(response.data ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load sidecar data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [entity, open, supabase, tab]);

  if (!open) return null;

  const heading = entity
    ? {
        agent: `Agent · ${entity.title}`,
        request: `Request · ${entity.title}`,
        policy: `Policy · ${entity.title}`,
        task: `Task · ${entity.title}`,
      }[entity.category]
    : "Agent sidecar";

  const renderBody = () => {
    if (!entity) {
      return <p className="text-sm text-[color:var(--color-muted)]">Select an item from Omnisearch to inspect live activity.</p>;
    }

    if (!supabase) {
      return (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
          Supabase client is not configured. Provide NEXT_PUBLIC_SUPABASE_URL to enable live sidecar data.
        </p>
      );
    }

    if (loading) {
      return <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>;
    }

    if (error) {
      return <p className="text-sm text-red-600">{error}</p>;
    }

    if (entity.category === "agent") {
      if (tab === "overview") {
        if (!agentOverview) {
          return <p className="text-sm text-[color:var(--color-muted)]">No profile data available for this agent.</p>;
        }
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">{agentOverview.name}</h3>
              {agentOverview.description && (
                <p className="text-sm text-[color:var(--color-muted)]">{agentOverview.description}</p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm text-[color:var(--color-foreground)]">
              <div>
                <dt className="text-[color:var(--color-muted)]">Status</dt>
                <dd>{agentOverview.enabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">Agent type</dt>
                <dd>{agentOverview.agent_type}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">SLA minutes</dt>
                <dd>{agentOverview.sla_minutes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">Last updated</dt>
                <dd>{formatDate(agentOverview.updated_at)}</dd>
              </div>
            </dl>
          </div>
        );
      }

      if (tab === "logs") {
        if (agentLogs.length === 0) {
          return <p className="text-sm text-[color:var(--color-muted)]">No active or historical sessions yet.</p>;
        }
        return (
          <ul className="space-y-3">
            {agentLogs.map((session) => (
              <li
                key={session.id}
                className="rounded-lg border border-[color:var(--color-border)]/60 bg-white/70 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[color:var(--color-foreground)]">{session.status}</span>
                  <span className="text-[color:var(--color-muted)]">{session.id.slice(0, 8)}…</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-[color:var(--color-muted)]">
                  <span>Started {formatDate(session.started_at)}</span>
                  <span>Deadline {formatDate(session.deadline_at)}</span>
                  <span>Completed {formatDate(session.completed_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        );
      }

      if (tab === "tasks") {
        if (agentTasks.length === 0) {
          return <p className="text-sm text-[color:var(--color-muted)]">No open tasks for this agent.</p>;
        }
        return (
          <ul className="space-y-3">
            {agentTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-[color:var(--color-border)]/60 bg-white/70 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[color:var(--color-foreground)]">{task.title ?? task.id}</span>
                  <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{task.status}</span>
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                  Due {formatDate(task.due_at)} · Created {formatDate(task.created_at)}
                </div>
              </li>
            ))}
          </ul>
        );
      }

      if (tab === "policies") {
        if (policyEntries.length === 0) {
          return <p className="text-sm text-[color:var(--color-muted)]">No policy settings found.</p>;
        }
        return (
          <ul className="space-y-3">
            {policyEntries.map((entry) => (
              <li key={entry.key} className="rounded-lg border border-[color:var(--color-border)]/60 bg-white/70 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[color:var(--color-foreground)]">{entry.key}</span>
                  <span className="text-xs text-[color:var(--color-muted)]">Updated {formatDate(entry.updated_at)}</span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-white/80 p-2 text-xs text-[color:var(--color-muted)]">
                  {renderJson(entry.value)}
                </pre>
              </li>
            ))}
          </ul>
        );
      }
    }

    if (entity.category === "request") {
      if (tab === "logs") {
        if (!sessionDetail) {
          return <p className="text-sm text-[color:var(--color-muted)]">No session telemetry available.</p>;
        }
        return (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-3 text-[color:var(--color-foreground)]">
              <div>
                <dt className="text-[color:var(--color-muted)]">Status</dt>
                <dd>{sessionDetail.status}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">Agent type</dt>
                <dd>{sessionDetail.agent_type}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">Started</dt>
                <dd>{formatDate(sessionDetail.started_at)}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-muted)]">Deadline</dt>
                <dd>{formatDate(sessionDetail.deadline_at)}</dd>
              </div>
            </dl>
            {sessionDetail.request_data && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Request payload</h4>
                <pre className="max-h-64 overflow-auto rounded bg-white/80 p-2 text-xs text-[color:var(--color-muted)]">
                  {renderJson(sessionDetail.request_data)}
                </pre>
              </div>
            )}
          </div>
        );
      }

      if (tab === "tasks") {
        return (
          <p className="text-sm text-[color:var(--color-muted)]">
            Tasks are tracked per agent persona. Open a task from Omnisearch to view execution progress.
          </p>
        );
      }
    }

    if (entity.category === "policy") {
      if (policyEntries.length === 0) {
        return <p className="text-sm text-[color:var(--color-muted)]">Policy value not found.</p>;
      }
      const entry = policyEntries[0];
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">{entry.key}</h3>
            <span className="text-xs text-[color:var(--color-muted)]">Updated {formatDate(entry.updated_at)}</span>
          </div>
          <pre className="max-h-72 overflow-auto rounded bg-white/80 p-3 text-xs text-[color:var(--color-muted)]">
            {renderJson(entry.value)}
          </pre>
        </div>
      );
    }

    if (entity.category === "task") {
      if (!taskDetail) {
        return <p className="text-sm text-[color:var(--color-muted)]">Task details unavailable.</p>;
      }
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">{taskDetail.title ?? entity.title}</h3>
            <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{taskDetail.status}</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[color:var(--color-foreground)]">
            <div>
              <dt className="text-[color:var(--color-muted)]">Due</dt>
              <dd>{formatDate(taskDetail.due_at)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--color-muted)]">Created</dt>
              <dd>{formatDate(taskDetail.created_at)}</dd>
            </div>
            {taskDetail.assigned_to && (
              <div>
                <dt className="text-[color:var(--color-muted)]">Assigned to</dt>
                <dd>{taskDetail.assigned_to}</dd>
              </div>
            )}
            {taskDetail.created_by && (
              <div>
                <dt className="text-[color:var(--color-muted)]">Created by</dt>
                <dd>{taskDetail.created_by}</dd>
              </div>
            )}
          </dl>
          {taskDetail.payload && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Details</h4>
              <pre className="max-h-72 overflow-auto rounded bg-white/80 p-2 text-xs text-[color:var(--color-muted)]">
                {renderJson(taskDetail.payload)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-sm text-[color:var(--color-muted)]">No data available.</p>;
  };

  return (
    <Drawer title={heading} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {entity && allowedTabs.length > 1 && (
          <nav className="flex items-center gap-2 border-b border-[color:var(--color-border)]/60 pb-2 text-sm">
            {allowedTabs.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onTabChange(value)}
                className={classNames(
                  "rounded-full px-3 py-1 transition",
                  value === tab
                    ? "bg-[color:var(--color-accent)]/90 text-[color:var(--color-accent-foreground)]"
                    : "bg-[color:var(--color-surface)] text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]",
                )}
              >
                {TAB_LABELS[value]}
              </button>
            ))}
          </nav>
        )}
        <div className="space-y-3 text-sm text-[color:var(--color-foreground)]">{renderBody()}</div>
      </div>
    </Drawer>
  );
}
