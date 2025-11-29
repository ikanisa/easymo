'use client';

import { FileJson,FlaskConical, Save, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/Textarea';

interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;
  actualOutput?: string;
  status?: 'pending' | 'running' | 'passed' | 'failed';
  executionTime?: number;
}

interface AgentTestBenchProps {
  agentId: string;
  agentName?: string;
}

export function AgentTestBench({ agentId, agentName = 'Agent' }: AgentTestBenchProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: '1',
      name: 'Basic greeting',
      input: 'Hello, how are you?',
      status: 'pending'
    },
    {
      id: '2',
      name: 'Location query',
      input: 'Find restaurants near Times Square',
      status: 'pending'
    }
  ]);

  const [selectedTest, setSelectedTest] = useState<string | null>(testCases[0]?.id || null);
  const [newTestName, setNewTestName] = useState('');
  const [newTestInput, setNewTestInput] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState('0.7');

  const runTest = async (testId: string) => {
    const test = testCases.find(t => t.id === testId);
    if (!test) return;

    // Update status to running
    setTestCases(prev => prev.map(t => 
      t.id === testId ? { ...t, status: 'running' as const } : t
    ));

    const startTime = Date.now();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          provider,
          model,
          messages: [{ role: 'user', content: test.input }],
          temperature: parseFloat(temperature)
        })
      });

      const data = await response.json();
      const executionTime = Date.now() - startTime;

      const actualOutput = data.choices?.[0]?.message?.content || data.content || 'No response';

      // Determine pass/fail based on expected output (if provided)
      let status: 'passed' | 'failed' = 'passed';
      if (test.expectedOutput && test.expectedOutput.trim()) {
        status = actualOutput.toLowerCase().includes(test.expectedOutput.toLowerCase()) 
          ? 'passed' 
          : 'failed';
      }

      setTestCases(prev => prev.map(t => 
        t.id === testId 
          ? { ...t, actualOutput, status, executionTime } 
          : t
      ));

    } catch (error) {
      setTestCases(prev => prev.map(t => 
        t.id === testId 
          ? { 
              ...t, 
              actualOutput: `Error: ${error}`, 
              status: 'failed' as const,
              executionTime: Date.now() - startTime
            } 
          : t
      ));
    }
  };

  const runAllTests = async () => {
    for (const test of testCases) {
      await runTest(test.id);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const addTestCase = () => {
    if (!newTestName.trim() || !newTestInput.trim()) return;

    const newTest: TestCase = {
      id: Date.now().toString(),
      name: newTestName.trim(),
      input: newTestInput.trim(),
      status: 'pending'
    };

    setTestCases(prev => [...prev, newTest]);
    setNewTestName('');
    setNewTestInput('');
    setSelectedTest(newTest.id);
  };

  const deleteTestCase = (testId: string) => {
    setTestCases(prev => prev.filter(t => t.id !== testId));
    if (selectedTest === testId) {
      setSelectedTest(testCases[0]?.id || null);
    }
  };

  const exportTests = () => {
    const dataStr = JSON.stringify(testCases, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `agent-tests-${agentId}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importTests = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTestCases(imported);
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const selectedTestData = testCases.find(t => t.id === selectedTest);
  const passedTests = testCases.filter(t => t.status === 'passed').length;
  const failedTests = testCases.filter(t => t.status === 'failed').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Test Cases */}
      <Card className="p-6 lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Test Cases</h3>
          </div>
          <Badge variant="secondary">{testCases.length}</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded bg-muted">
            <div className="text-xs text-muted-foreground">Passed</div>
            <div className="text-lg font-bold text-green-600">{passedTests}</div>
          </div>
          <div className="text-center p-2 rounded bg-muted">
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-lg font-bold text-red-600">{failedTests}</div>
          </div>
          <div className="text-center p-2 rounded bg-muted">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-bold">{testCases.length}</div>
          </div>
        </div>

        <ScrollArea className="h-[400px] mb-4">
          <div className="space-y-2">
            {testCases.map((test) => (
              <div
                key={test.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTest === test.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedTest(test.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">{test.name}</h4>
                      {test.status && test.status !== 'pending' && (
                        <Badge
                          variant={
                            test.status === 'running' ? 'secondary' :
                            test.status === 'passed' ? 'default' :
                            'destructive'
                          }
                          className="text-xs"
                        >
                          {test.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {test.input}
                    </p>
                    {test.executionTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {test.executionTime}ms
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTestCase(test.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <Button onClick={runAllTests} className="w-full" variant="default">
            <FlaskConical className="h-4 w-4 mr-2" />
            Run All Tests
          </Button>
          <div className="flex gap-2">
            <Button onClick={exportTests} variant="outline" className="flex-1">
              <FileJson className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <label>
                <FileJson className="h-4 w-4 mr-2" />
                Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={importTests}
                />
              </label>
            </Button>
          </div>
        </div>
      </Card>

      {/* Right Panel - Test Details */}
      <Card className="p-6 lg:col-span-2">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Test Details</TabsTrigger>
            <TabsTrigger value="new">New Test</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {!selectedTestData ? (
              <div className="text-center py-20 text-muted-foreground">
                <FlaskConical className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No test selected</p>
                <p className="text-sm">Select a test case to view details</p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{selectedTestData.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">ID: {selectedTestData.id}</Badge>
                    {selectedTestData.status && (
                      <Badge
                        variant={
                          selectedTestData.status === 'running' ? 'secondary' :
                          selectedTestData.status === 'passed' ? 'default' :
                          selectedTestData.status === 'failed' ? 'destructive' :
                          'outline'
                        }
                      >
                        {selectedTestData.status}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Input</Label>
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    {selectedTestData.input}
                  </div>
                </div>

                {selectedTestData.expectedOutput && (
                  <div className="space-y-2">
                    <Label>Expected Output</Label>
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      {selectedTestData.expectedOutput}
                    </div>
                  </div>
                )}

                {selectedTestData.actualOutput && (
                  <div className="space-y-2">
                    <Label>Actual Output</Label>
                    <div className={`p-3 rounded-lg text-sm ${
                      selectedTestData.status === 'passed'
                        ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900'
                        : selectedTestData.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900'
                        : 'bg-muted'
                    }`}>
                      {selectedTestData.actualOutput}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => runTest(selectedTestData.id)}
                  disabled={selectedTestData.status === 'running'}
                  className="w-full"
                >
                  {selectedTestData.status === 'running' ? 'Running...' : 'Run Test'}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="test-name">Test Name</Label>
              <Input
                id="test-name"
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                placeholder="e.g., Location search query"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-input">Test Input</Label>
              <Textarea
                id="test-input"
                value={newTestInput}
                onChange={(e) => setNewTestInput(e.target.value)}
                rows={4}
                placeholder="Enter the test message/prompt..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provider === 'openai' ? (
                      <>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={addTestCase}
              disabled={!newTestName.trim() || !newTestInput.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Add Test Case
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
