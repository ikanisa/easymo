'use client';

import useSWR from 'swr';
import styles from './IntegrationsStatus.module.css';

interface IntegrationStatus {
  status: 'green' | 'amber' | 'red';
  message: string;
}

interface StatusResponse {
  voucherPreview: IntegrationStatus;
  whatsappSend: IntegrationStatus;
  campaignDispatcher: IntegrationStatus;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LABELS: Record<keyof StatusResponse, string> = {
  voucherPreview: 'Voucher preview',
  whatsappSend: 'WhatsApp send',
  campaignDispatcher: 'Campaign dispatcher'
};

export function IntegrationsStatus() {
  const { data, error, isLoading } = useSWR<StatusResponse>('/api/integrations/status', fetcher, {
    refreshInterval: 60000
  });

  if (isLoading) {
    return <p>Checking integrations…</p>;
  }

  if (error || !data) {
    return <p>Unable to load integrations status.</p>;
  }

  return (
    <div className={styles.grid}>
      {(Object.keys(LABELS) as Array<keyof StatusResponse>).map((key) => {
        const entry = data[key];
        return (
          <div key={key} className={`${styles.card} ${styles[`card_${entry.status}`]}`}>
            <span className={styles.label}>{LABELS[key]}</span>
            <span className={styles.message}>{entry.message}</span>
          </div>
        );
      })}
    </div>
  );
}
