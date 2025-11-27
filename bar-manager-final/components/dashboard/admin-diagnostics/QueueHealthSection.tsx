import type { AdminDiagnosticsQueues } from "@/lib/schemas";

const LABELS: Array<{ key: keyof AdminDiagnosticsQueues; label: string; description: string }> = [
  {
    key: "notificationsQueued",
    label: "Notifications queued",
    description: "Pending WhatsApp messages waiting for delivery.",
  },
  {
    key: "mobilityOpenTrips",
    label: "Open trips",
    description: "Rider/driver requests still awaiting a match.",
  },
  {
    key: "ocrPending",
    label: "Data-quality jobs",
    description: "Menu OCR jobs queued or processing.",
  },
];

type QueueHealthSectionProps = {
  queues: AdminDiagnosticsQueues;
};

export function QueueHealthSection({ queues }: QueueHealthSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Queue depth</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {LABELS.map((item) => (
          <article
            key={item.key}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {item.label}
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {queues[item.key].toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
