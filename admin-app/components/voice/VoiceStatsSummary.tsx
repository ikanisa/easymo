import { SectionCard } from "@/components/ui/SectionCard";

type Stats = {
  totalCalls: number;
  completed: number;
  failed: number;
  averageDurationSeconds: number | null;
  firstTimeToAssistantSeconds: number | null;
};

interface VoiceStatsSummaryProps {
  stats: Stats | null;
}

export function VoiceStatsSummary({ stats }: VoiceStatsSummaryProps) {
  if (!stats) return null;
  return (
    <SectionCard title="Summary" description="Aggregated stats for the selected range">
      <dl className="grid gap-4 sm:grid-cols-5">
        <Stat label="Total calls" value={stats.totalCalls} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Failed" value={stats.failed} />
        <Stat label="Avg duration" value={formatSeconds(stats.averageDurationSeconds)} />
        <Stat label="p95 time to agent" value={formatSeconds(stats.firstTimeToAssistantSeconds)} />
      </dl>
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-surface)]/60 p-4 shadow-[var(--elevation-low)]">
      <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{label}</dt>
      <dd className="text-2xl font-semibold text-[color:var(--color-foreground)]">{value}</dd>
    </div>
  );
}

function formatSeconds(value: number | null): string {
  if (!value || value <= 0) return "—";
  if (value < 60) return `${value.toFixed(1)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}
