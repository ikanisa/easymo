"use client";

import { SectionCard } from "@/components/ui/SectionCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAgentRegistry, useAgentSessions, useAgentMetrics } from "@/lib/queries/agent-orchestration";
import { SessionDrawer } from "@/components/agent-orchestration/SessionDrawer";
import { AgentConfigDrawer } from "@/components/agent-orchestration/AgentConfigDrawer";
import { useState } from "react";
import type { DashboardKpi } from "@/lib/schemas";
import { SessionTimelineCard } from "@/components/agent-orchestration/SessionTimelineCard";

export function AgentOrchestrationClient() {
  const registryQuery = useAgentRegistry();
  const sessionsQuery = useAgentSessions({ status: "searching", limit: 20 });
  const metricsQuery = useAgentMetrics({ days: 7 });

  const [selectedAgentType, setSelectedAgentType] = useState<string | undefined>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();

  // Build KPIs
  const kpis: DashboardKpi[] = metricsQuery.data?.kpis
    ? [
        {
          label: "Active Sessions",
          primaryValue: String(metricsQuery.data.kpis.active_sessions),
          secondaryValue: "currently running",
          trend: "flat" as const,
        },
        {
          label: "Timeout Rate",
          primaryValue: `${metricsQuery.data.kpis.timeout_rate}%`,
          secondaryValue: "last 7 days",
          trend: parseFloat(metricsQuery.data.kpis.timeout_rate) < 5 ? "down" : "up",
        },
        {
          label: "Acceptance Rate",
          primaryValue: `${metricsQuery.data.kpis.acceptance_rate}%`,
          secondaryValue: "completed sessions",
          trend: parseFloat(metricsQuery.data.kpis.acceptance_rate) > 80 ? "up" : "down",
        },
        {
          label: "Total Sessions",
          primaryValue: String(metricsQuery.data.kpis.total_sessions),
          secondaryValue: "last 7 days",
          trend: "flat" as const,
        },
      ]
    : [];

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Agent Orchestration</h1>
        <p className="text-muted-foreground">
          Monitor 14 autonomous agents handling driver negotiation, marketplace sourcing, and sales outreach.
        </p>
      </header>

      {/* Performance Metrics */}
      <SectionCard title="Performance Metrics" description="Key performance indicators">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metricsQuery.isLoading && (
            <div className="col-span-4 text-center text-sm text-muted-foreground">
              Loading metrics...
            </div>
          )}
          {metricsQuery.isError && (
            <div className="col-span-4 text-center text-sm text-red-600">
              Failed to load metrics
            </div>
          )}
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      </SectionCard>

      {/* Agent Registry */}
      <SectionCard
        title="Agent Registry"
        description="Feature flags, SLA configs, and rollout controls"
      >
        {registryQuery.isLoading && (
          <div className="text-center text-sm text-muted-foreground">Loading agents...</div>
        )}
        {registryQuery.isError && (
          <div className="text-center text-sm text-red-600">Failed to load agents</div>
        )}
        {registryQuery.data?.agents && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-3 font-medium">Agent</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">SLA</th>
                  <th className="p-3 font-medium">Rollout</th>
                  <th className="p-3 font-medium">Tools</th>
                </tr>
              </thead>
              <tbody>
                {registryQuery.data.agents.map((agent: any) => (
                  <tr
                    key={agent.id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedAgentType(agent.agent_type)}
                  >
                    <td className="p-3 font-medium">{agent.name}</td>
                    <td className="p-3 text-muted-foreground">{agent.agent_type}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          agent.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {agent.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{agent.sla_minutes} min</td>
                    <td className="p-3 text-muted-foreground">{agent.feature_flag_scope}</td>
                    <td className="p-3 text-muted-foreground">
                      {agent.enabled_tools?.length || 0} tools
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Live Sessions */}
      <SectionCard
        title="Live Sessions"
        description="Real-time 5-minute SLA tracker"
      >
        {sessionsQuery.isLoading && (
          <div className="text-center text-sm text-muted-foreground">Loading sessions...</div>
        )}
        {sessionsQuery.isError && (
          <div className="text-center text-sm text-red-600">Failed to load sessions</div>
        )}
        {sessionsQuery.data?.sessions && sessionsQuery.data.sessions.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No active sessions at the moment
          </div>
        )}
        {sessionsQuery.data?.sessions && sessionsQuery.data.sessions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-3 font-medium">Session ID</th>
                  <th className="p-3 font-medium">Flow Type</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Started</th>
                  <th className="p-3 font-medium">Deadline</th>
                  <th className="p-3 font-medium">Quotes</th>
                </tr>
              </thead>
              <tbody>
                {sessionsQuery.data.sessions.map((session: any) => {
                  const deadline = new Date(session.deadline_at);
                  const now = new Date();
                  const remainingMs = deadline.getTime() - now.getTime();
                  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
                  const isUrgent = remainingMinutes < 1;

                  return (
                    <tr 
                      key={session.id} 
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <td className="p-3 font-mono text-xs">
                        {session.id.slice(0, 8)}...
                      </td>
                      <td className="p-3">{session.flow_type}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            session.status === "searching"
                              ? "bg-blue-100 text-blue-700"
                              : session.status === "negotiating"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(session.started_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-medium ${
                            isUrgent ? "text-red-600 font-bold" : "text-muted-foreground"
                          }`}
                        >
                          {remainingMinutes} min
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {session.agent_quotes?.[0]?.count || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SessionTimelineCard />

      {/* Session Detail Drawer */}
      {selectedSessionId && (
        <SessionDrawer
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(undefined)}
        />
      )}

      {/* Agent Config Drawer */}
      {selectedAgentType && (
        <AgentConfigDrawer
          agentType={selectedAgentType}
          onClose={() => setSelectedAgentType(undefined)}
        />
      )}
    </div>
  );
}
