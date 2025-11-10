import { AgentsDashboardClient } from "./AgentsDashboardClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/agents/dashboard");

export default function AgentsDashboardPage() {
  return <AgentsDashboardClient />;
import { useState, useEffect, useMemo, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { subscribeWithMonitoring } from "@/lib/monitoring/realtime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface AgentStatus {
  agentType: string;
  name: string;
  enabled: boolean;
  activeSessions: number;
  completedToday: number;
  averageResponseTime: number;
  successRate: number;
  status: "active" | "idle" | "error";
}

interface ActiveSession {
  id: string;
  agentType: string;
  userId: string;
  status: string;
  startedAt: string;
  deadlineAt: string;
}

export default function AgentsDashboardPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeNow: 0,
    completedToday: 0,
    avgResponseTime: 0,
  });
  const supabase = useMemo(() => getSupabaseClient(), []);

  const loadDashboardData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      // Load agent registry
      const { data: agentRegistry } = await supabase
        .from("agent_registry")
        .select("*")
        .eq("enabled", true);

      // Load active sessions
      const { data: sessions } = await supabase
        .from("agent_sessions")
        .select("*")
        .in("status", ["searching", "negotiating"])
        .order("started_at", { ascending: false })
        .limit(10);

      // Load completed sessions today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: completedSessions, count: completedCount } = await supabase
        .from("agent_sessions")
        .select("*", { count: "exact" })
        .eq("status", "completed")
        .gte("completed_at", today.toISOString());

      // Calculate agent statuses
      const agentStatuses: AgentStatus[] = (agentRegistry || []).map((agent: any) => {
        const agentSessions = (sessions || []).filter(
          (s: any) => s.agent_type === agent.agent_type
        );
        
        const agentCompleted = (completedSessions || []).filter(
          (s: any) => s.agent_type === agent.agent_type
        );

        const avgResponseTime = agentCompleted.length > 0
          ? agentCompleted.reduce((sum: number, s: any) => {
              const start = new Date(s.started_at).getTime();
              const end = new Date(s.completed_at).getTime();
              return sum + (end - start);
            }, 0) / agentCompleted.length / 1000
          : 0;

        return {
          agentType: agent.agent_type,
          name: agent.name,
          enabled: agent.enabled,
          activeSessions: agentSessions.length,
          completedToday: agentCompleted.length,
          averageResponseTime: Math.round(avgResponseTime),
          successRate: agentCompleted.length > 0 
            ? Math.round((agentCompleted.length / (agentCompleted.length + agentSessions.length)) * 100)
            : 0,
          status: agentSessions.length > 0 ? "active" : "idle",
        };
      });

      setAgents(agentStatuses);
      setActiveSessions(sessions || []);
      setStats({
        totalSessions: (completedCount || 0) + (sessions?.length || 0),
        activeNow: sessions?.length || 0,
        completedToday: completedCount || 0,
        avgResponseTime: Math.round(
          agentStatuses.reduce((sum, a) => sum + a.averageResponseTime, 0) / agentStatuses.length
        ),
      });
      
      setLoading(false);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    loadDashboardData();
    
    // Set up real-time subscription with monitoring hooks
    const channel = subscribeWithMonitoring(supabase, {
      channel: "agent-dashboard",
      table: "agent_sessions",
      onEvent: () => {
        loadDashboardData();
      },
      sla: {
        deadlineField: "deadline_at",
        statusField: "status",
        completedStatuses: ["completed", "cancelled"],
        channel: "agent_sessions_sla",
      },
    });

    // Refresh every 10 seconds
    const interval = setInterval(loadDashboardData, 10000);

    return () => {
      channel?.unsubscribe();
      clearInterval(interval);
    };
  }, [supabase, loadDashboardData]);

  const getAgentIcon = (agentType: string) => {
    const icons: Record<string, string> = {
      'driver_negotiation': '🚗',
      'pharmacy_sourcing': '💊',
      'shops': '🛍️',
      'quincaillerie': '🔧',
      'property_rental': '🏠',
      'schedule_trip': '📅',
    };
    return icons[agentType] || '🤖';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <p>Loading AI Agents Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Agents Dashboard</h1>
          <p className="text-gray-600">Monitor and manage all autonomous AI agents</p>
        </div>
        <Button asChild>
          <Link href="/agents/settings">Agent Settings</Link>
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-gray-500">All time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.activeNow}</div>
            <p className="text-xs text-gray-500">Currently processing</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.completedToday}</div>
            <p className="text-xs text-gray-500">Successful completions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgResponseTime}s</div>
            <p className="text-xs text-gray-500">Across all agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Status Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Agent Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.agentType} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getAgentIcon(agent.agentType)}</span>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <p className="text-xs text-gray-500">{agent.agentType}</p>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Active Sessions:</span>
                  <Badge variant={agent.activeSessions > 0 ? "green" : "slate"}>
                    {agent.activeSessions}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Completed Today:</span>
                  <span className="font-semibold">{agent.completedToday}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Avg Response:</span>
                  <span className="font-semibold">{agent.averageResponseTime}s</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Success Rate:</span>
                  <span className="font-semibold">{agent.successRate}%</span>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link href={`/agents/${agent.agentType}`}>
                    View Details →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
        <Card>
          <CardContent className="p-0">
            {activeSessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No active sessions at the moment
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Agent</th>
                      <th className="text-left p-3 font-medium">Session ID</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Started</th>
                      <th className="text-left p-3 font-medium">Deadline</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((session) => {
                      const timeLeft = new Date(session.deadlineAt).getTime() - Date.now();
                      const minutesLeft = Math.floor(timeLeft / 60000);
                      
                      return (
                        <tr key={session.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <span>{getAgentIcon(session.agentType)}</span>
                              <span className="font-medium">{session.agentType}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {session.id.substring(0, 8)}...
                          </td>
                          <td className="p-3">
                            <Badge variant={session.status === "searching" ? "blue" : session.status === "negotiating" ? "yellow" : "gray"}>
                              {session.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-gray-600">
                            {new Date(session.startedAt).toLocaleTimeString()}
                          </td>
                          <td className="p-3">
                            <span className={`text-xs ${minutesLeft < 2 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              {minutesLeft}m remaining
                            </span>
                          </td>
                          <td className="p-3">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/sessions/${session.id}` as any}>
                                View
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Link href="/agents/conversations" className="block">
                <div className="text-center">
                  <div className="text-4xl mb-2">💬</div>
                  <h3 className="font-semibold">Live Conversations</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Monitor agent-vendor conversations in real-time
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Link href="/agents/learning" className="block">
                <div className="text-center">
                  <div className="text-4xl mb-2">🧠</div>
                  <h3 className="font-semibold">Agent Learning</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    View patterns and training data
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Link href="/agents/performance" className="block">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <h3 className="font-semibold">Performance Analytics</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Detailed metrics and trends
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
