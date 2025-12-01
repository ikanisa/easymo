"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentMetrics {
  slug: string;
  name: string;
  total_conversations: number;
  unique_users: number;
  total_messages: number;
  avg_response_time_seconds: number;
  total_tool_executions: number;
  tool_success_rate: number;
  avg_tool_execution_time_ms: number;
  unique_tools_used: number;
  date: string;
}

interface ToolUsage {
  agent_slug: string;
  tool_name: string;
  tool_type: string;
  execution_count: number;
  success_rate: number;
  avg_execution_time_ms: number;
  unique_users: number;
  date: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

export function AgentPerformanceDashboard() {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("7d");

  useEffect(() => {
    loadAnalytics();
    
    // Set up realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('analytics-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          loadAnalytics();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedAgent, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Load agent performance metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('agent_performance_dashboard')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

      if (metricsError) throw metricsError;
      
      // Load tool usage analytics
      const { data: toolData, error: toolError } = await supabase
        .from('tool_usage_analytics')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

      if (toolError) throw toolError;

      setMetrics(metricsData || []);
      setToolUsage(toolData || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by selected agent
  const filteredMetrics = selectedAgent === "all" 
    ? metrics 
    : metrics.filter(m => m.slug === selectedAgent);

  const filteredToolUsage = selectedAgent === "all"
    ? toolUsage
    : toolUsage.filter(t => t.agent_slug === selectedAgent);

  // Aggregate data by agent
  const agentSummary = metrics.reduce((acc, metric) => {
    if (!acc[metric.slug]) {
      acc[metric.slug] = {
        name: metric.name,
        conversations: 0,
        users: 0,
        messages: 0,
        toolExecutions: 0,
      };
    }
    acc[metric.slug].conversations += metric.total_conversations;
    acc[metric.slug].users += metric.unique_users;
    acc[metric.slug].messages += metric.total_messages;
    acc[metric.slug].toolExecutions += metric.total_tool_executions;
    return acc;
  }, {} as Record<string, any>);

  const agentPieData = Object.entries(agentSummary).map(([slug, data]) => ({
    name: data.name,
    value: data.conversations,
  }));

  // Response time trend
  const responseTimeTrend = filteredMetrics
    .slice(0, 30)
    .reverse()
    .map(m => ({
      date: new Date(m.date).toLocaleDateString(),
      responseTime: Math.round(m.avg_response_time_seconds * 10) / 10,
      agent: m.name,
    }));

  // Tool success rate
  const toolSuccessData = filteredToolUsage
    .slice(0, 10)
    .map(t => ({
      tool: t.tool_name,
      successRate: Math.round(t.success_rate * 100),
      executions: t.execution_count,
    }));

  // Get unique agents for filter
  const uniqueAgents = Array.from(new Set(metrics.map(m => m.slug))).map(slug => {
    const metric = metrics.find(m => m.slug === slug);
    return { slug, name: metric?.name || slug };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {uniqueAgents.map(agent => (
              <SelectItem key={agent.slug} value={agent.slug}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="tools">Tool Usage</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.reduce((sum, m) => sum + m.total_conversations, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {Object.keys(agentSummary).length} agents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.reduce((sum, m) => sum + m.unique_users, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(filteredMetrics.reduce((sum, m) => sum + m.avg_response_time_seconds, 0) / 
                    Math.max(filteredMetrics.length, 1)).toFixed(1)}s
                </div>
                <p className="text-xs text-muted-foreground">
                  Average across all agents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tool Executions</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredMetrics.reduce((sum, m) => sum + m.total_tool_executions, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(filteredMetrics.reduce((sum, m) => sum + m.tool_success_rate, 0) / 
                    Math.max(filteredMetrics.length, 1) * 100).toFixed(1)}% success rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Agent Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Conversations by Agent</CardTitle>
              <CardDescription>Distribution of conversations across different AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agentPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {agentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Trend</CardTitle>
              <CardDescription>Average response time over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (s)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool Success Rate</CardTitle>
              <CardDescription>Success rate and execution count for top tools</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={toolSuccessData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tool" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successRate" fill="#00C49F" name="Success Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tool Executions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Usage Details</CardTitle>
              <CardDescription>Detailed breakdown of tool executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Tool</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Executions</th>
                      <th className="text-right p-2">Success Rate</th>
                      <th className="text-right p-2">Avg Time (ms)</th>
                      <th className="text-right p-2">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredToolUsage.slice(0, 20).map((tool, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{tool.tool_name}</td>
                        <td className="p-2 text-sm text-muted-foreground">{tool.tool_type}</td>
                        <td className="p-2 text-right">{tool.execution_count}</td>
                        <td className="p-2 text-right">{(tool.success_rate * 100).toFixed(1)}%</td>
                        <td className="p-2 text-right">{tool.avg_execution_time_ms.toFixed(0)}</td>
                        <td className="p-2 text-right">{tool.unique_users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement</CardTitle>
              <CardDescription>Messages and interactions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredMetrics.slice(0, 30).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total_messages" stroke="#8884d8" name="Messages" />
                  <Line type="monotone" dataKey="unique_users" stroke="#82ca9d" name="Users" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
