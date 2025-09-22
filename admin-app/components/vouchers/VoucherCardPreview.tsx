import styles from './VoucherCardPreview.module.css';

interface VoucherCardPreviewProps {
  amount: number;
  currency: string;
  code: string;
  expiresAt?: string | null;
  barName?: string;
  notes?: string;
}

export function VoucherCardPreview({ amount, currency, code, expiresAt, barName, notes }: VoucherCardPreviewProps) {
  const amountLabel = `${amount.toLocaleString()} ${currency}`;
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleDateString() : 'No expiry set';

  return (
    <div className={styles.card} aria-label="Voucher preview">
      <header className={styles.header}>
        <span className={styles.brand}>easyMO Voucher</span>
        {barName ? <span className={styles.bar}>{barName}</span> : null}
      </header>
      <div className={styles.amountSection}>
        <p className={styles.amountLabel}>Value</p>
        <p className={styles.amount}>{amountLabel}</p>
      </div>
      <div className={styles.codeSection}>
        <p className={styles.codeLabel}>Redeem code</p>
        <p className={styles.code}>{code}</p>
      </div>
      <div className={styles.qrPlaceholder} aria-hidden="true">
        QR Placeholder
      </div>
      <footer className={styles.footer}>
        <div>
          <strong>Expires</strong>
          <span>{expiryText}</span>
        </div>
        <div>
          <strong>Notes</strong>
          <span>{notes ?? 'Single-use voucher. Present to station operator.'}</span>
        </div>
      </footer>
    </div>
  );
}
