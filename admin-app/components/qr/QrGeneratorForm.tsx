'use client';

import { useState } from 'react';
import type { Bar } from '@/lib/schemas';
import styles from './QrGeneratorForm.module.css';
import { useToast } from '@/components/ui/ToastProvider';
import { IntegrationStatusBadge } from '@/components/ui/IntegrationStatusBadge';

interface QrGeneratorFormProps {
  bars: Bar[];
}

interface TokenResult {
  id: string;
  barName: string;
  tableLabel: string;
  token: string;
  createdAt: string;
}

export function QrGeneratorForm({ bars }: QrGeneratorFormProps) {
  const [barId, setBarId] = useState(bars[0]?.id ?? '');
  const [tableLabels, setTableLabels] = useState('Table 1');
  const [batchCount, setBatchCount] = useState(1);
  const [tokens, setTokens] = useState<TokenResult[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [integration, setIntegration] = useState<{ target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } | null>(null);
  const { pushToast } = useToast();

  const selectedBar = bars.find((bar) => bar.id === barId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBar) return;
    setIsSubmitting(true);
    setFeedback(null);
    setTokens(null);
    setIntegration(null);

    try {
      const response = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `qr-${Date.now()}`
        },
        body: JSON.stringify({
          barName: selectedBar.name,
          tableLabels: tableLabels
            .split(',')
            .map((label) => label.trim())
            .filter(Boolean),
          batchCount
        })
      });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        const text = data?.error ?? 'Failed to generate QR tokens.';
        setFeedback(text);
        pushToast(text, 'error');
      } else {
        setTokens(data.tokens ?? []);
        const text = `Generated ${data.tokens?.length ?? 0} QR tokens.`;
        setFeedback(text);
        pushToast(text, 'success');
      }
    } catch (error) {
      console.error('QR generate failed', error);
      setFeedback('Unexpected error while generating QR tokens.');
      pushToast('Unexpected error while generating QR tokens.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label>
          <span>Bar</span>
          <select value={barId} onChange={(event) => setBarId(event.target.value)}>
            {bars.map((bar) => (
              <option key={bar.id} value={bar.id}>
                {bar.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Table labels (comma separated)</span>
          <input
            value={tableLabels}
            onChange={(event) => setTableLabels(event.target.value)}
            placeholder="Table 1, Table 2"
          />
        </label>
        <label>
          <span>Batch count</span>
          <input
            type="number"
            min={1}
            max={20}
            value={batchCount}
            onChange={(event) => setBatchCount(Number(event.target.value))}
          />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting || !selectedBar}>
        {isSubmitting ? 'Generating…' : 'Generate tokens'}
      </button>
      {integration ? <IntegrationStatusBadge integration={integration} label="QR generator" /> : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
      {tokens && tokens.length ? (
        <div className={styles.results}>
          <h4>Generated tokens</h4>
          <ul>
            {tokens.map((token) => (
              <li key={token.id}>
                <strong>{token.token}</strong> – {token.tableLabel} ({new Date(token.createdAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
