'use client';

import { useState } from 'react';
import { Settings, TestTube, Wrench, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Tool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

interface AgentToolConfigProps {
  agentId: string;
  tools?: Tool[];
  onToolsUpdated?: (tools: Tool[]) => void;
}

const AVAILABLE_TOOLS = [
  {
    id: 'google_maps_search',
    name: 'Google Maps Search',
    description: 'Search for places, get directions, and location information',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        location: { type: 'string', description: 'Location bias' },
        radius: { type: 'number', description: 'Search radius in meters' }
      },
      required: ['query']
    }
  },
  {
    id: 'google_search',
    name: 'Google Search',
    description: 'Search the web with Google Custom Search',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results', default: 10 }
      },
      required: ['query']
    }
  },
  {
    id: 'database_query',
    name: 'Database Query',
    description: 'Query the Supabase database for information',
    schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        filters: { type: 'object', description: 'Query filters' },
        limit: { type: 'number', description: 'Result limit' }
      },
      required: ['table']
    }
  },
  {
    id: 'generate_image',
    name: 'Generate Image',
    description: 'Generate images using AI',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Image description' },
        size: { type: 'string', description: 'Image size', enum: ['256x256', '512x512', '1024x1024'] }
      },
      required: ['prompt']
    }
  },
  {
    id: 'send_notification',
    name: 'Send Notification',
    description: 'Send push notifications or messages',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Target user ID' },
        message: { type: 'string', description: 'Notification message' },
        channel: { type: 'string', enum: ['push', 'sms', 'whatsapp'] }
      },
      required: ['user_id', 'message']
    }
  }
];

export function AgentToolConfig({ agentId, tools: initialTools = [], onToolsUpdated }: AgentToolConfigProps) {
  const [tools, setTools] = useState<Tool[]>(
    initialTools.length > 0 
      ? initialTools 
      : AVAILABLE_TOOLS.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          enabled: false,
          parameters: {}
        }))
  );
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('{}');
  const [testOutput, setTestOutput] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const toggleTool = (toolId: string) => {
    const updated = tools.map(t => 
      t.id === toolId ? { ...t, enabled: !t.enabled } : t
    );
    setTools(updated);
    onToolsUpdated?.(updated);
  };

  const testTool = async () => {
    if (!selectedTool) return;

    setIsTesting(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/tools/${selectedTool}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testInput
      });

      const result = await response.json();
      setTestOutput(result);
    } catch (error) {
      setTestOutput({ error: 'Test failed', details: error });
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/tools`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools })
      });

      if (response.ok) {
        alert('Tool configuration saved successfully');
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration');
    }
  };

  const selectedToolData = selectedTool 
    ? AVAILABLE_TOOLS.find(t => t.id === selectedTool)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Tool List */}
      <Card className="p-6 lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Available Tools</h3>
          </div>
          <Badge variant="secondary">
            {tools.filter(t => t.enabled).length}/{tools.length}
          </Badge>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {tools.map((tool) => {
              const toolDef = AVAILABLE_TOOLS.find(t => t.id === tool.id);
              return (
                <div
                  key={tool.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTool === tool.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedTool(tool.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{tool.name}</h4>
                        {tool.enabled && (
                          <Badge variant="default" className="text-xs">ON</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                    <Switch
                      checked={tool.enabled}
                      onCheckedChange={() => toggleTool(tool.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Button onClick={saveConfiguration} className="w-full mt-4">
          <Settings className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </Card>

      {/* Right Panel - Tool Details & Testing */}
      <Card className="p-6 lg:col-span-2">
        {!selectedTool ? (
          <div className="text-center py-20 text-muted-foreground">
            <Wrench className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No tool selected</p>
            <p className="text-sm">Select a tool from the list to view details and test</p>
          </div>
        ) : (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="test">Test</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">{selectedToolData?.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedToolData?.description}</p>
              </div>

              <div className="space-y-2">
                <Label>Function Schema</Label>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                  {JSON.stringify(selectedToolData?.schema, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <Label>Implementation Status</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Implemented and ready to use
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Example Usage</Label>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
{`// Call from agent
const result = await tools.${selectedTool}({
${Object.entries(selectedToolData?.schema.properties || {})
  .map(([key, value]: [string, any]) => `  ${key}: "${value.description || 'value'}"`)
  .join(',\n')}
});`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="test-input">Test Input (JSON)</Label>
                <Textarea
                  id="test-input"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={JSON.stringify(
                    Object.fromEntries(
                      Object.keys(selectedToolData?.schema.properties || {}).map(k => [k, ''])
                    ),
                    null,
                    2
                  )}
                />
              </div>

              <Button
                onClick={testTool}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <TestTube className="h-4 w-4 mr-2 animate-pulse" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>

              {testOutput && (
                <div className="space-y-2">
                  <Label>Test Output</Label>
                  <div className={`p-4 rounded-lg border ${
                    testOutput.error 
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                  }`}>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(testOutput, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Tests run in a sandbox environment. Actual results may vary in production.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
}
