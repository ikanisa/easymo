import type { AdminDiagnosticsSnapshot } from "@/lib/schemas";

import { AdminConfigSection } from "./AdminConfigSection";
import { DiagnosticsNotice } from "./DiagnosticsNotice";
import { LogsSection } from "./LogsSection";
import { MatchMetricsSection } from "./MatchMetricsSection";
import { QueueHealthSection } from "./QueueHealthSection";
import { TripDiagnosticsSection } from "./TripDiagnosticsSection";

type AdminDiagnosticsContentProps = {
  snapshot: AdminDiagnosticsSnapshot;
};

export function AdminDiagnosticsContent({
  snapshot,
}: AdminDiagnosticsContentProps) {
  return (
    <div className="space-y-4">
      <DiagnosticsNotice messages={snapshot.health.messages} />
      <AdminConfigSection health={snapshot.health} />
      <MatchMetricsSection matches={snapshot.matches} />
      <QueueHealthSection queues={snapshot.queues} />
      <LogsSection logs={snapshot.logs} />
      <TripDiagnosticsSection />
    </div>
  );
}
