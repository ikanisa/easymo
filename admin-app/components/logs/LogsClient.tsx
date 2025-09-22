'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { IntegrationStatusBadge } from '@/components/ui/IntegrationStatusBadge';

interface LogsPayload {
  audit: Array<{ id: string; actor: string; action: string; target_table: string; target_id: string; created_at: string; diff?: unknown }>;
  events: Array<{ id: string; orderId: string; type: string; createdAt: string }>;
  integration?: { target: string; status: 'ok' | 'degraded'; reason?: string; message?: string };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LogsClient() {
  const { data, error, isLoading } = useSWR<LogsPayload>('/api/logs', fetcher, { refreshInterval: 30000 });
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  if (isLoading) {
    return <LoadingState message="Loading logs…" />;
  }

  if (error || !data) {
    return <EmptyState title="Unable to load logs" description="Check network and try again." />;
  }

  const filteredAudit = useMemo(
    () =>
      data.audit.filter((entry) => {
        const actorMatch = actorFilter ? entry.actor.toLowerCase().includes(actorFilter.toLowerCase()) : true;
        const targetMatch = targetFilter
          ? `${entry.target_table}/${entry.target_id}`.toLowerCase().includes(targetFilter.toLowerCase())
          : true;
        return actorMatch && targetMatch;
      }),
    [data.audit, actorFilter, targetFilter]
  );

  return (
    <div className="placeholder-grid">
      {data.integration ? <IntegrationStatusBadge integration={data.integration} label="Logs source" /> : null}
      <SectionCard title="Audit log" description="Recent actions across the admin panel.">
        <div className="filters">
          <label>
            <span>Actor</span>
            <input value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} placeholder="e.g. admin" />
          </label>
          <label>
            <span>Target</span>
            <input value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} placeholder="e.g. vouchers" />
          </label>
        </div>
        {filteredAudit.length ? (
          <ul>
            {filteredAudit.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action}</strong> by {entry.actor} on {entry.target_table}/{entry.target_id} –
                {new Date(entry.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No matching audit entries" description="Adjust the filters to see more results." />
        )}
      </SectionCard>

      <SectionCard title="Voucher events" description="Recent order events (mock).">
        <ul>
          {data.events.map((event) => (
            <li key={event.id}>
              <strong>{event.orderId}</strong> – {event.type} – {new Date(event.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
