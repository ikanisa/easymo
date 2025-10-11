import { LoadingState } from "@/components/ui/LoadingState";
import type { LoanEvent } from "@/lib/queries/baskets";
import styles from "../LoanReviewDrawer.module.css";

type LoanTimelineSectionProps = {
  events?: LoanEvent[];
  isLoading: boolean;
};

export function LoanTimelineSection({
  events,
  isLoading,
}: LoanTimelineSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Timeline</h3>
      </div>
      {isLoading
        ? (
          <LoadingState
            title="Loading timeline"
            description="Fetching loan events."
          />
        )
        : events?.length
        ? (
          <div className={styles.timeline}>
            {events.map((event) => (
              <div key={event.id} className={styles.timelineItem}>
                <strong>{event.toStatus}</strong>
                <div className={styles.timelineMeta}>
                  {new Date(event.createdAt).toLocaleString()} —{" "}
                  {event.actorRole ?? "system"}
                </div>
                {event.notes
                  ? <div className={styles.timelineMeta}>{event.notes}</div>
                  : null}
              </div>
            ))}
          </div>
        )
        : <p className={styles.emptyText}>No timeline events recorded yet.</p>}
    </section>
  );
}
