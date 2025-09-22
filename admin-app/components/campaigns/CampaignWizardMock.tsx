'use client';

import { useState } from 'react';
import type { TemplateMeta } from '@/lib/schemas';
import { TemplatePicker } from '@/components/templates/TemplatePicker';
import { CsvUpload } from '@/components/uploads/CsvUpload';
import { IntegrationStatusBadge } from '@/components/ui/IntegrationStatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import styles from './CampaignWizardMock.module.css';

interface CampaignWizardMockProps {
  templates: TemplateMeta[];
}

export function CampaignWizardMock({ templates }: CampaignWizardMockProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  const [csvPreview, setCsvPreview] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState<'promo' | 'voucher'>('voucher');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [integration, setIntegration] = useState<{ target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const { pushToast } = useToast();

  const canSubmit = Boolean(selectedTemplate && campaignName.trim() && csvPreview && csvPreview > 0);

  const handleCreateDraft = async () => {
    if (!canSubmit) {
      pushToast('Select a template, provide a name, and upload recipient CSV first.', 'error');
      return;
    }
    setIsSubmitting(true);
    setIntegration(null);
    setResultMessage(null);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          type: campaignType,
          templateId: selectedTemplate,
          metadata: { csvRows: csvPreview }
        })
      });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        const text = data?.message ?? 'Campaign draft failed.';
        setResultMessage(text);
        pushToast(text, 'error');
      } else {
        const text = data?.message ?? 'Campaign draft saved.';
        setResultMessage(text);
        pushToast(text, 'success');
      }
    } catch (error) {
      console.error('Campaign draft failed', error);
      const text = 'Unexpected error while saving campaign draft.';
      setResultMessage(text);
      pushToast(text, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section>
        <h3>1. Choose template</h3>
        <TemplatePicker templates={templates} value={selectedTemplate} onChange={setSelectedTemplate} />
        {selectedTemplate ? (
          <p className={styles.selection}>Selected template: {selectedTemplate}</p>
        ) : (
          <p className={styles.helper}>Select a template to map campaign variables.</p>
        )}
      </section>

      <section>
        <h3>2. Upload recipients CSV</h3>
        <CsvUpload
          instructions="Upload targets with headers (e.g. msisdn, customer_name, amount). Preview will show row count only while API work is pending."
          onPreview={(rows) => setCsvPreview(rows.length)}
        />
        {csvPreview !== null ? (
          <p className={styles.helper}>{csvPreview} rows parsed successfully.</p>
        ) : null}
      </section>

      <section>
        <h3>3. Draft settings</h3>
        <div className={styles.formGrid}>
          <label>
            <span>Campaign name</span>
            <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="October promo" />
          </label>
          <label>
            <span>Type</span>
            <select value={campaignType} onChange={(event) => setCampaignType(event.target.value as 'promo' | 'voucher')}>
              <option value="voucher">Voucher</option>
              <option value="promo">Promo</option>
            </select>
          </label>
        </div>
        <button type="button" onClick={handleCreateDraft} disabled={!canSubmit || isSubmitting} className={styles.submit}>
          {isSubmitting ? 'Saving…' : 'Save campaign draft'}
        </button>
        {integration ? <IntegrationStatusBadge integration={integration} label="Campaign dispatcher" /> : null}
        {resultMessage ? <p className={styles.helper}>{resultMessage}</p> : null}
        {!canSubmit ? (
          <p className={styles.helperMuted}>Select a template, provide a name, and upload recipients before saving.</p>
        ) : null}
      </section>
    </div>
  );
}
