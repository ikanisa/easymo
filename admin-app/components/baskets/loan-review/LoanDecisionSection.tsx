import { Button } from "@/components/ui/Button";
import type { LoanRow } from "@/lib/queries/baskets";
import styles from "../LoanReviewDrawer.module.css";

type LoanDecisionSectionProps = {
  status: string;
  statusReason: string;
  decisionNotes: string;
  scheduledAt: string;
  canApprove: boolean;
  canReject: boolean;
  canDisburse: boolean;
  isBusy: boolean;
  onStatusChange: (value: string) => void;
  onStatusReasonChange: (value: string) => void;
  onDecisionNotesChange: (value: string) => void;
  onScheduledAtChange: (value: string) => void;
  onSaveStatus: (status: LoanRow["status"]) => void;
  onUpdateSchedule: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDisburse: () => void;
};

export function LoanDecisionSection({
  status,
  statusReason,
  decisionNotes,
  scheduledAt,
  canApprove,
  canReject,
  canDisburse,
  isBusy,
  onStatusChange,
  onStatusReasonChange,
  onDecisionNotesChange,
  onScheduledAtChange,
  onSaveStatus,
  onUpdateSchedule,
  onApprove,
  onReject,
  onDisburse,
}: LoanDecisionSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>SACCO decision</h3>
      </div>
      <div className={`${styles.fieldGroup} ${styles.inline}`}>
        <label className={styles.field}>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="endorsing">Endorsing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Disbursement scheduled</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => onScheduledAtChange(event.target.value)}
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>Status reason</span>
        <textarea
          className={styles.small}
          value={statusReason}
          onChange={(event) => onStatusReasonChange(event.target.value)}
          placeholder="Internal reason or borrower-facing note"
        />
      </label>
      <label className={styles.field}>
        <span>Decision notes</span>
        <textarea
          className={styles.small}
          value={decisionNotes}
          onChange={(event) => onDecisionNotesChange(event.target.value)}
          placeholder="Optional notes shown in audit trail"
        />
      </label>
      <div className={styles.actionsRow}>
        <Button
          size="sm"
          onClick={() => onSaveStatus(status as LoanRow["status"])}
          disabled={isBusy}
        >
          Save status
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onUpdateSchedule}
          disabled={isBusy}
        >
          Update schedule
        </Button>
        {canApprove
          ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onApprove}
              disabled={isBusy}
            >
              Approve
            </Button>
          )
          : null}
        {canReject
          ? (
            <Button
              size="sm"
              variant="danger"
              onClick={onReject}
              disabled={isBusy}
            >
              Reject
            </Button>
          )
          : null}
        {canDisburse
          ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onDisburse}
              disabled={isBusy}
            >
              Mark disbursed
            </Button>
          )
          : null}
      </div>
    </section>
  );
}
