import type { LoanRow } from "@/lib/queries/baskets";
import styles from "../LoanReviewDrawer.module.css";

type LoanSummarySectionProps = {
  loan: LoanRow;
  principalText: string;
  collateralText: string;
  ltvDisplay: string;
  minLtv: number | null;
  belowCoverage: boolean;
};

export function LoanSummarySection({
  loan,
  principalText,
  collateralText,
  ltvDisplay,
  minLtv,
  belowCoverage,
}: LoanSummarySectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Summary</h3>
        <span className={styles.badge}>{loan.status}</span>
      </div>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span>Principal</span>
          <div className={styles.summaryValue}>{principalText}</div>
        </div>
        <div className={styles.summaryItem}>
          <span>Tenure</span>
          <div className={styles.summaryValue}>{loan.tenureMonths} months</div>
        </div>
        <div className={styles.summaryItem}>
          <span>Rate APR</span>
          <div className={styles.summaryValue}>
            {loan.rateApr != null ? `${loan.rateApr}%` : "—"}
          </div>
        </div>
        <div className={styles.summaryItem}>
          <span>Collateral pledged</span>
          <div className={styles.summaryValue}>{collateralText}</div>
        </div>
        <div className={styles.summaryItem}>
          <span>LTV coverage</span>
          <div className={styles.summaryValue}>{ltvDisplay}</div>
        </div>
        {minLtv != null
          ? (
            <div className={styles.summaryItem}>
              <span>Min required LTV</span>
              <div className={styles.summaryValue}>{minLtv.toFixed(2)}x</div>
            </div>
          )
          : null}
      </div>
      {belowCoverage
        ? (
          <p className={styles.alert}>
            Collateral below required coverage. Gather additional collateral or reject.
          </p>
        )
        : null}
      {loan.purpose
        ? <p className={styles.summaryValue}>Purpose: {loan.purpose}</p>
        : null}
    </section>
  );
}
