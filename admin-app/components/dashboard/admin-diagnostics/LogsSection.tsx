import type { AdminDiagnosticsLogs } from "@/lib/schemas";
import { DiagnosticsNotice } from "./DiagnosticsNotice";

type LogsSectionProps = {
  logs: AdminDiagnosticsLogs;
};

export function LogsSection({ logs }: LogsSectionProps) {
  const entries = logs.logs.slice(0, 5);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">
        Recent webhook logs
      </h3>
      <DiagnosticsNotice
        messages={logs.messages}
        className="mb-2"
        dense
      />
      <ul className="grid gap-2 text-sm">
        {entries.map((log) => (
          <li
            key={log.id}
            className="rounded-md border border-border bg-card p-2"
          >
            <div className="font-medium text-foreground">
              {log.endpoint ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Status {log.status_code ?? "—"} · {log.received_at ?? "—"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
