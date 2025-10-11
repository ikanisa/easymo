"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReminderLogs, type ReminderLog } from "@/lib/queries/baskets";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import styles from "./BasketsSettingsForm.module.css";

export function ReminderLogsCard() {
  const logsQuery = useQuery<ReminderLog[]>({
    queryKey: ["baskets", "reminders", "logs"],
    queryFn: fetchReminderLogs,
    staleTime: 60_000,
  });

  if (logsQuery.isLoading) {
    return (
      <div className={styles.section}>
        <LoadingState
          title="Loading reminder logs"
          description="Fetching recent reminder delivery attempts."
        />
      </div>
    );
  }

  if (logsQuery.isError) {
    return (
      <div className={styles.section}>
        <EmptyState
          title="Reminder logs unavailable"
          description="Unable to load reminder history right now."
        />
      </div>
    );
  }

  const logs = logsQuery.data ?? [];

  if (!logs.length) {
    return (
      <div className={styles.section}>
        <EmptyState
          title="No reminder events"
          description="Reminder attempts will appear here once scheduling is active."
        />
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <h3>Reminder delivery log</h3>
      <ul className={styles.logsList}>
        {logs.map((log) => (
          <li key={log.id} className={styles.logItem}>
            <div className={styles.logHeader}>
              <span className={styles.logEvent}>{log.event}</span>
              <span className={styles.logTimestamp}>{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className={styles.logBody}>
              <span>{log.reminderType ?? 'unknown'} · {log.reminderStatus ?? 'pending'}</span>
              {log.memberName || log.memberMsisdn ? (
                <span className={styles.logMeta}>
                  {log.memberName ?? 'Member'} · {log.memberMsisdn ?? '—'}
                </span>
              ) : null}
              {log.reason ? (
                <span className={styles.logMeta}>Reason: {log.reason}</span>
              ) : null}
              {log.blockedReason ? (
                <span className={styles.logMeta}>Blocked: {log.blockedReason}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

