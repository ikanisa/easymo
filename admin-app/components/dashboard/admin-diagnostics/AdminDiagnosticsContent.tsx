import type { AdminDiagnosticsSnapshot } from "@/lib/schemas";
import { DiagnosticsNotice } from "./DiagnosticsNotice";
import { AdminConfigSection } from "./AdminConfigSection";
import { LogsSection } from "./LogsSection";
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
      <LogsSection logs={snapshot.logs} />
      <TripDiagnosticsSection />
    </div>
  );
}
