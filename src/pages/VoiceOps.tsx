import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceCallList } from '@/features/voice/components/VoiceCallList';
import { VoiceCallDetailsPanel } from '@/features/voice/components/VoiceCallDetails';
import { getVoiceCallDetails, listVoiceCalls } from '@/features/voice/api';
import type { VoiceCall } from '@/features/voice/types';

export const resolveDurationSeconds = (call: VoiceCall): number | null => {
  if (typeof call.durationSeconds === 'number' && call.durationSeconds >= 0) {
    return call.durationSeconds;
  }
  if (call.startedAt && call.endedAt) {
    const delta = new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime();
    if (!Number.isNaN(delta) && delta > 0) {
      return Math.round(delta / 1000);
    }
  }
  return null;
};

export const formatAverage = (seconds: number | null, sampleSize: number) => {
  if (!seconds || seconds <= 0 || sampleSize === 0) {
    return { value: '—', description: 'No completed calls yet' };
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return {
    value: `${mins}m ${secs}s`,
    description: `Across ${sampleSize} completed call${sampleSize === 1 ? '' : 's'}`,
  };
};

export default function VoiceOps() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const callsQuery = useQuery({
    queryKey: ['voice-calls'],
    queryFn: async () => {
      const data = await listVoiceCalls({ limit: 50 });
      setLastUpdated(new Date());
      return data;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const calls = useMemo(() => callsQuery.data ?? [], [callsQuery.data]);

  useEffect(() => {
    if (calls.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(calls[0].id);
      return;
    }
    const exists = calls.some((call) => call.id === selectedId);
    if (!exists) {
      setSelectedId(calls[0].id);
    }
  }, [calls, selectedId]);

  const durations = useMemo(() => {
    return calls
      .map((call) => resolveDurationSeconds(call))
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  }, [calls]);

  const liveCalls = useMemo(() => calls.filter((call) => !call.endedAt).length, [calls]);
  const handoffCount = useMemo(() => calls.filter((call) => call.handoff).length, [calls]);

  const averageSeconds = durations.length
    ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
    : null;

  const average = formatAverage(averageSeconds, durations.length);

  const detailsQuery = useQuery({
    queryKey: ['voice-call', selectedId],
    queryFn: () => (selectedId ? getVoiceCallDetails(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId),
    refetchInterval: selectedId ? 20000 : false,
  });

  const metrics = [
    {
      label: 'Live Calls',
      value: liveCalls.toString(),
      description: 'Sessions still streaming audio',
    },
    {
      label: 'Calls Loaded',
      value: calls.length.toString(),
      description: 'Most recent Supabase fetch window',
    },
    {
      label: 'Avg Duration',
      value: average.value,
      description: average.description,
    },
    {
      label: 'Handoffs',
      value: handoffCount.toString(),
      description: 'Escalations requested by the agent',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Voice Agent Ops"
          description="Monitor realtime calls, transcripts, and tool usage for OpenAI voice agents."
          action={{
            label: callsQuery.isFetching ? 'Refreshing…' : 'Refresh',
            onClick: () => callsQuery.refetch(),
            disabled: callsQuery.isFetching,
            icon: RefreshCw,
          }}
        />

        {callsQuery.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {callsQuery.error instanceof Error
                ? callsQuery.error.message
                : 'Failed to load voice calls from Supabase.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{metric.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
          <VoiceCallList
            calls={calls}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            onFilterChange={setFilter}
            isLoading={callsQuery.isFetching && !callsQuery.data}
            onRefresh={() => callsQuery.refetch()}
            lastUpdated={lastUpdated}
          />

          <VoiceCallDetailsPanel
            details={detailsQuery.data ?? undefined}
            isLoading={detailsQuery.isFetching && !detailsQuery.data}
            error={detailsQuery.error instanceof Error ? detailsQuery.error : undefined}
            onRefresh={() => detailsQuery.refetch()}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
