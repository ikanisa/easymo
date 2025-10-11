import { type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { LoanRow } from "@/lib/queries/baskets";
import styles from "../LoanReviewDrawer.module.css";
import { formatCurrency } from "./utils";

type LoanCollateralSectionProps = {
  currency: string;
  items: LoanRow["collateral"];
  form: {
    source: string;
    amount: string;
    valuation: string;
    coverage: string;
  };
  onFormChange: {
    source: (value: string) => void;
    amount: (value: string) => void;
    valuation: (value: string) => void;
    coverage: (value: string) => void;
  };
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (id: string) => void;
  isSubmitting: boolean;
  isRemoving: boolean;
};

export function LoanCollateralSection({
  currency,
  items,
  form,
  onFormChange,
  onSubmit,
  onRemove,
  isSubmitting,
  isRemoving,
}: LoanCollateralSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Collateral</h3>
      </div>
      {items.length
        ? (
          <div className={styles.collateralList}>
            {items.map((item) => (
              <div key={item.id} className={styles.collateralItem}>
                <div>
                  <div className={styles.summaryValue}>
                    {formatCurrency(item.amount, currency)} •{" "}
                    {item.source.replace("_", " ")}
                  </div>
                  <div className={styles.collateralMeta}>
                    Coverage: {item.coverageRatio != null
                      ? `${(item.coverageRatio * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                  {item.valuation != null
                    ? (
                      <div className={styles.collateralMeta}>
                        Valuation: {formatCurrency(item.valuation, currency)}
                      </div>
                    )
                    : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(item.id)}
                  disabled={isRemoving}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )
        : <p className={styles.emptyText}>No collateral pledged yet.</p>}

      <form className={styles.fieldGroup} onSubmit={onSubmit}>
        <div className={`${styles.fieldGroup} ${styles.inline}`}>
          <label className={styles.field}>
            <span>Source</span>
            <select
              value={form.source}
              onChange={(event) => onFormChange.source(event.target.value)}
            >
              <option value="group_savings">Group savings</option>
              <option value="member_savings">Member savings</option>
              <option value="guarantor">Guarantor pledge</option>
              <option value="asset">Asset</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Amount ({currency})</span>
            <input
              required
              value={form.amount}
              onChange={(event) => onFormChange.amount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
            />
          </label>
          <label className={styles.field}>
            <span>Valuation ({currency})</span>
            <input
              value={form.valuation}
              onChange={(event) => onFormChange.valuation(event.target.value)}
              type="number"
              min="0"
              step="0.01"
            />
          </label>
          <label className={styles.field}>
            <span>Coverage ratio</span>
            <input
              value={form.coverage}
              onChange={(event) => onFormChange.coverage(event.target.value)}
              type="number"
              min="0"
              step="0.01"
            />
          </label>
        </div>
        <div className={styles.actionsRow}>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            Add collateral
          </Button>
        </div>
      </form>
    </section>
  );
}
