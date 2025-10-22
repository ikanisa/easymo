import { RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VoiceCallDetails, VoiceTranscript } from '../types';

interface VoiceCallDetailsProps {
  details?: VoiceCallDetails | null;
  isLoading: boolean;
  error?: Error | null;
  onRefresh: () => void;
}

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Kigali',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const computeDuration = (details?: VoiceCallDetails | null) => {
  if (!details) return '—';
  const { call } = details;
  if (typeof call.durationSeconds === 'number' && call.durationSeconds >= 0) {
    const mins = Math.floor(call.durationSeconds / 60);
    const secs = call.durationSeconds % 60;
    return `${mins}m ${secs}s`;
  }
  if (call.startedAt && call.endedAt) {
    const delta = new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime();
    if (!Number.isNaN(delta) && delta > 0) {
      const seconds = Math.round(delta / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
  }
  return call.endedAt ? '—' : 'Live';
};

const renderTranscriptLine = (line: VoiceTranscript) => (
  <div key={line.id} className="flex gap-3 rounded-md border p-3">
    <Badge variant={line.role === 'assistant' ? 'default' : line.role === 'system' ? 'secondary' : 'outline'}>
      {line.role}
    </Badge>
    <div className="flex-1 space-y-1">
      <p className="text-sm leading-relaxed">{line.content}</p>
      <p className="text-xs text-muted-foreground">{formatTimestamp(line.timestamp)}</p>
    </div>
  </div>
);

export function VoiceCallDetailsPanel({ details, isLoading, error, onRefresh }: VoiceCallDetailsProps) {
  if (isLoading && !details) {
    return (
      <Card className="h-full">
        <CardHeader className="space-y-2">
          <CardTitle>Call Details</CardTitle>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!details) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Call Details</CardTitle>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh call details</span>
          </Button>
        </CardHeader>
        <CardContent className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <p>Select a call from the list to inspect transcripts, tool calls, and guardrail events.</p>
        </CardContent>
      </Card>
    );
  }

  const { call, transcripts, events, toolCalls, consents } = details;
  const status = call.endedAt ? 'Completed' : 'Live';
  const metadata = call.metadata ? JSON.stringify(call.metadata, null, 2) : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Call Summary</CardTitle>
            <p className="text-sm text-muted-foreground">{call.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'Live' ? 'default' : 'secondary'}>{status}</Badge>
            {call.handoff && <Badge variant="outline">Handoff</Badge>}
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Refresh call</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Direction</span>
              <span className="font-medium capitalize">{call.direction}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-mono">{call.fromE164 ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-mono">{call.toE164 ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started</span>
              <span>{formatTimestamp(call.startedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ended</span>
              <span>{formatTimestamp(call.endedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span>{computeDuration(details)}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent</span>
              <span className="font-medium">{call.agentProfile ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence</span>
              <span>{call.agentProfileConfidence ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country</span>
              <span>{call.country ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outcome</span>
              <span className="capitalize">{call.outcome ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campaign Tags</span>
              <span>{call.campaignTags?.join(', ') ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consent</span>
              <span>{call.consentObtained ? 'Captured' : 'Pending'}</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs">
              {metadata ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-left">{metadata}</pre>
              ) : (
                <span className="text-muted-foreground">No metadata stored for this call.</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="transcripts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transcripts">Transcripts ({transcripts.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="tools">Tool Calls ({toolCalls.length})</TabsTrigger>
          <TabsTrigger value="consent">Consent ({consents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transcripts">
          {transcripts.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground text-center">
                No transcripts yet.
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-80 rounded-md border p-4">
              <div className="space-y-3">
                {transcripts.map((line) => renderTranscriptLine(line))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="space-y-3 py-4">
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              )}
              {events.map((event) => (
                <div key={event.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{event.type ?? 'event'}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {JSON.stringify(event.payload ?? {}, null, 2)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardContent className="space-y-3 py-4">
              {toolCalls.length === 0 && (
                <p className="text-sm text-muted-foreground">No MCP tool calls logged.</p>
              )}
              {toolCalls.map((tool) => (
                <div key={tool.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{tool.server ?? 'server'}</Badge>
                      <span className="font-medium">{tool.tool ?? 'tool'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTimestamp(tool.timestamp)}</span>
                      <Badge variant={tool.success ? 'default' : 'destructive'}>
                        {tool.success ? 'ok' : 'error'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Arguments</p>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs bg-muted/40 p-2 rounded">
                        {JSON.stringify(tool.args ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Result</p>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs bg-muted/40 p-2 rounded">
                        {JSON.stringify(tool.result ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent">
          <Card>
            <CardContent className="space-y-3 py-4">
              {consents.length === 0 && (
                <p className="text-sm text-muted-foreground">No consent events logged.</p>
              )}
              {consents.map((consent) => (
                <div key={consent.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{consent.consentResult ? 'Approved' : 'Rejected'}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(consent.timestamp)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{consent.consentText ?? '—'}</p>
                  {consent.audioUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs"
                      onClick={() => window.open(consent.audioUrl ?? '#', '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" /> Listen to clip
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
