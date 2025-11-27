"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, AlertCircle, CheckCircle2, TrendingUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Persona {
  id: string;
  role_name: string;
  tone_style: string;
  languages: string[];
  traits: string[];
  is_default: boolean;
}

interface Instruction {
  id: string;
  title: string;
  instructions: string;
  guardrails: string[];
  memory_strategy: string;
  is_active: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  tool_type: string;
  is_active: boolean;
}

interface AgentMetrics {
  conversations: {
    total: number;
    lastWeek: number;
  };
  toolExecutions: {
    total: number;
    successful: number;
    failed: number;
    avgExecutionTime: number;
  };
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  model_primary: string;
  model_fallback: string;
  personas: Persona[];
  instructions: Instruction[];
  tools: Tool[];
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgentDetails();
      fetchMetrics();
    }
  }, [agentId]);

  const fetchAgentDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ai-agents/${agentId}`);
      const result = await response.json();

      if (result.success) {
        setAgent(result.data);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/ai-agents/${agentId}/metrics`);
      const result = await response.json();

      if (result.success) {
        setMetrics(result.data);
      }
    } catch (err: any) {
      console.error("Error fetching metrics:", err);
    }
  };

  const updatePersona = async (personaId: string, updates: Partial<Persona>) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/ai-agents/${agentId}/persona`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, updates }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Persona updated successfully");
        fetchAgentDetails();
      } else {
        toast.error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateInstructions = async (instructionId: string, updates: Partial<Instruction>) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/ai-agents/${agentId}/instructions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructionId, updates }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Instructions updated successfully");
        fetchAgentDetails();
      } else {
        toast.error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = async (toolId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/ai-agents/${agentId}/tools/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Tool ${isActive ? "enabled" : "disabled"}`);
        fetchAgentDetails();
      } else {
        toast.error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error Loading Agent</CardTitle>
            <CardDescription className="text-red-700">{error || "Agent not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          <p className="text-muted-foreground mt-2">{agent.description}</p>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline">{agent.slug}</Badge>
            <Badge variant="outline">Primary: {agent.model_primary}</Badge>
            {agent.model_fallback && (
              <Badge variant="secondary">Fallback: {agent.model_fallback}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personas">Personas ({agent.personas.length})</TabsTrigger>
          <TabsTrigger value="instructions">Instructions ({agent.instructions.length})</TabsTrigger>
          <TabsTrigger value="tools">Tools ({agent.tools.length})</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Personas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agent.personas.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agent.personas.filter((p) => p.is_default).length} default
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">System Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agent.instructions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agent.instructions.filter((i) => i.is_active).length} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Available Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agent.tools.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agent.tools.filter((t) => t.is_active).length} active
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Personas Tab */}
        <TabsContent value="personas" className="space-y-4">
          {agent.personas.map((persona) => (
            <Card key={persona.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {persona.role_name}
                    {persona.is_default && <Badge>Default</Badge>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Tone & Style</label>
                  <Textarea
                    value={persona.tone_style}
                    onChange={(e) => {
                      const updated = { ...persona, tone_style: e.target.value };
                      setAgent({
                        ...agent,
                        personas: agent.personas.map((p) =>
                          p.id === persona.id ? updated : p
                        ),
                      });
                    }}
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Languages</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {persona.languages?.map((lang) => (
                      <Badge key={lang} variant="outline">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Traits</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {persona.traits?.map((trait) => (
                      <Badge key={trait} variant="secondary">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() =>
                    updatePersona(persona.id, { tone_style: persona.tone_style })
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="space-y-4">
          {agent.instructions.map((instruction) => (
            <Card key={instruction.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {instruction.title}
                    {instruction.is_active && <Badge>Active</Badge>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Instructions</label>
                  <Textarea
                    value={instruction.instructions}
                    onChange={(e) => {
                      const updated = { ...instruction, instructions: e.target.value };
                      setAgent({
                        ...agent,
                        instructions: agent.instructions.map((i) =>
                          i.id === instruction.id ? updated : i
                        ),
                      });
                    }}
                    rows={10}
                    className="mt-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Guardrails</label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {instruction.guardrails?.map((guardrail, idx) => (
                      <Badge key={idx} variant="outline">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {guardrail}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() =>
                    updateInstructions(instruction.id, {
                      instructions: instruction.instructions,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agent.tools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                    <Switch
                      checked={tool.is_active}
                      onCheckedChange={(checked) => toggleTool(tool.id, checked)}
                    />
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{tool.tool_type}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          {metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold">{metrics.conversations.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last 7 Days</span>
                    <span className="font-bold">{metrics.conversations.lastWeek}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tool Executions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold">{metrics.toolExecutions.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Successful</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-bold">{metrics.toolExecutions.successful}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Failed</span>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{metrics.toolExecutions.failed}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Time</span>
                    <span className="font-bold">{metrics.toolExecutions.avgExecutionTime}ms</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Loading metrics...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
