import type { AdminDiagnosticsMatchSummary } from "@/lib/schemas";
import { DiagnosticsNotice } from "./DiagnosticsNotice";

type MatchMetricsSectionProps = {
  matches: AdminDiagnosticsMatchSummary;
};

export function MatchMetricsSection({ matches }: MatchMetricsSectionProps) {
  const hasErrors = matches.recentErrors.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Mobility match telemetry
        </h3>
        <div className="text-xs text-muted-foreground">
          Last hour · Last 24h
        </div>
      </div>
      <DiagnosticsNotice
        messages={[...matches.messages]}
        className="mb-2"
        dense
      />
      <div className="grid gap-2 md:grid-cols-3">
        <MetricTile
          label="Matches processed"
          primary={matches.matchesLastHour}
          secondary={matches.matchesLast24h}
        />
        <MetricTile
          label="Open trips"
          primary={matches.openTrips}
          secondary={matches.matchesLast24h === 0 ? "—" : undefined}
        />
        <MetricTile
          label="Error signals"
          primary={matches.errorCountLastHour}
          tone={hasErrors ? "error" : "muted"}
          secondary={hasErrors ? undefined : "Healthy"}
        />
      </div>
      {hasErrors && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent error logs
          </h4>
          <ul className="mt-1 grid gap-1 text-xs text-muted-foreground">
            {matches.recentErrors.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border bg-card p-2">
                <div className="font-medium text-foreground">
                  {entry.endpoint ?? "Unknown endpoint"}
                </div>
                <div>
                  Status {entry.status_code ?? "—"} · {entry.received_at ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type MetricTileProps = {
  label: string;
  primary: number;
  secondary?: number | string;
  tone?: "default" | "error" | "muted";
};

function MetricTile({ label, primary, secondary, tone = "default" }: MetricTileProps) {
  const toneClass = tone === "error"
    ? "text-destructive"
    : tone === "muted"
    ? "text-muted-foreground"
    : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>
        {typeof primary === "number" ? primary.toLocaleString() : primary}
      </div>
      {secondary !== undefined && (
        <div className="text-xs text-muted-foreground">
          {typeof secondary === "number" ? `${secondary.toLocaleString()} in 24h` : secondary}
        </div>
      )}
    </div>
  );
}
