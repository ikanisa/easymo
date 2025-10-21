import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { VoiceCall } from '../types';

interface VoiceCallListProps {
  calls: VoiceCall[];
  selectedId?: string | null;
  onSelect: (callId: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated?: Date | null;
}

const formatStart = (iso: string) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Kigali',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (call: VoiceCall) => {
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

const matchesFilter = (call: VoiceCall, filter: string) => {
  if (!filter) return true;
  const haystack = [
    call.id,
    call.fromE164 ?? '',
    call.toE164 ?? '',
    call.agentProfile ?? '',
    call.outcome ?? '',
    call.country ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(filter.toLowerCase());
};

export function VoiceCallList({
  calls,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  isLoading,
  onRefresh,
  lastUpdated,
}: VoiceCallListProps) {
  const filtered = useMemo(() => calls.filter((call) => matchesFilter(call, filter)), [calls, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recent Calls</h2>
          <p className="text-sm text-muted-foreground">
            Monitor the latest realtime voice sessions from OpenAI bridge.
            {lastUpdated && (
              <span className="ml-2 italic">
                Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by phone, agent, outcome or country"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="w-full sm:w-72"
          />
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            <span className="sr-only">Refresh voice calls</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <ScrollArea className="h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead className="hidden xl:table-cell">Duration</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden xl:table-cell">Country</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="space-y-2 py-6">
                      {[0, 1, 2, 3].map((key) => (
                        <Skeleton key={key} className="h-10 w-full" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No calls match your filters.
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((call) => (
                <TableRow
                  key={call.id}
                  onClick={() => onSelect(call.id)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/60',
                    selectedId === call.id && 'bg-muted'
                  )}
                >
                  <TableCell className="font-medium">{formatStart(call.startedAt)}</TableCell>
                  <TableCell className="hidden xl:table-cell">{formatDuration(call)}</TableCell>
                  <TableCell>
                    <Badge variant={call.direction === 'inbound' ? 'secondary' : 'default'} className="capitalize">
                      {call.direction}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{call.fromE164 ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{call.toE164 ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{call.agentProfile ?? '—'}</span>
                      {call.agentProfileConfidence && (
                        <span className="text-xs text-muted-foreground">conf {call.agentProfileConfidence}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">{call.country ?? '—'}</TableCell>
                  <TableCell>
                    {call.outcome ? (
                      <Badge variant="outline" className="capitalize">
                        {call.outcome}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{call.endedAt ? 'Completed' : 'Live'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
