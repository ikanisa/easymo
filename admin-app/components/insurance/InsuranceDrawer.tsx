'use client';

import { useState } from 'react';
import type { InsuranceQuote } from '@/lib/schemas';
import { Drawer } from '@/components/ui/Drawer';
import styles from './InsuranceDrawer.module.css';
import { IntegrationStatusBadge } from '@/components/ui/IntegrationStatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface InsuranceDrawerProps {
  quote: InsuranceQuote;
  onClose: () => void;
}

export function InsuranceDrawer({ quote, onClose }: InsuranceDrawerProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [integration, setIntegration] = useState<{ target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } | null>(null);
  const [comment, setComment] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);

  const approve = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    setIntegration(null);
    try {
      const response = await fetch(`/api/insurance/${quote.id}/approve`, { method: 'POST' });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        setStatusMessage(data?.message ?? 'Approval failed.');
      } else {
        setStatusMessage(data.message ?? 'Quote approved (mock).');
      }
    } catch (error) {
      console.error('Approve quote failed', error);
      setStatusMessage('Unexpected error while approving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestChanges = async () => {
    if (!comment.trim()) {
      setStatusMessage('Provide a comment before requesting changes.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    setIntegration(null);
    try {
      const response = await fetch(`/api/insurance/${quote.id}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        setStatusMessage(data?.message ?? 'Request changes failed.');
      } else {
        setStatusMessage(data.message ?? 'Change request recorded (mock).');
        setComment('');
      }
    } catch (error) {
      console.error('Request changes failed', error);
      setStatusMessage('Unexpected error while requesting changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer title={`Insurance quote ${quote.id}`} onClose={onClose}>
      <div className={styles.section}>
        <h3>Status</h3>
        <p>{quote.status}</p>
      </div>
      <div className={styles.section}>
        <h3>Premium</h3>
        <p>{quote.premium ? `${quote.premium.toLocaleString()} RWF` : 'Pending pricing'}</p>
      </div>
      <div className={styles.section}>
        <h3>Documents</h3>
        <ul>
          {quote.uploadedDocs.map((doc) => (
            <li key={doc}>{doc}</li>
          ))}
        </ul>
      </div>
      <div className={styles.section}>
        <h3>Actions</h3>
        <div className={styles.actions}>
          <button type="button" onClick={() => setConfirmApprove(true)} disabled={isSubmitting} title="Approve this insurance quote">
            Approve
          </button>
          <button type="button" onClick={requestChanges} disabled={isSubmitting}>
            Request changes
          </button>
        </div>
        <label className={styles.commentField}>
          <span>Reviewer comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Explain what needs to change"
            rows={3}
          />
        </label>
      </div>
      {integration ? <IntegrationStatusBadge integration={integration} label="Insurance workflow" /> : null}
      {statusMessage ? <p className={styles.message}>{statusMessage}</p> : null}
      <ConfirmDialog
        open={confirmApprove}
        title="Approve insurance quote?"
        description="Approval notifies underwriting and moves this quote forward."
        confirmLabel="Yes, approve"
        onConfirm={async () => {
          await approve();
          setConfirmApprove(false);
        }}
        onCancel={() => setConfirmApprove(false)}
      />
    </Drawer>
  );
}
