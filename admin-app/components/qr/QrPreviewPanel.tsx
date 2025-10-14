"use client";

import { useEffect, useMemo, useState } from "react";

import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import type { Bar, QrPreview } from "@/lib/schemas";
import { requestQrPreview } from "@/lib/qr/qr-preview-service";

import styles from "./QrPreviewPanel.module.css";

interface QrPreviewPanelProps {
  bars: Bar[];
}

export function QrPreviewPanel({ bars }: QrPreviewPanelProps) {
  const defaultBarId = useMemo(() => bars[0]?.id ?? "", [bars]);
  const [barId, setBarId] = useState(defaultBarId);
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState<QrPreview | null>(null);
  const [integration, setIntegration] = useState<{
    status: "ok" | "degraded";
    target: string;
    message?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    if (!barId && defaultBarId) {
      setBarId(defaultBarId);
    }
  }, [barId, defaultBarId]);

  useEffect(() => {
    if (!barId) {
      setPreview(null);
      setIntegration(null);
      return;
    }
    void loadPreview({ sendTest: false, silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId]);

  async function loadPreview({ sendTest, silent }: { sendTest: boolean; silent?: boolean }) {
    if (!barId) return;
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await requestQrPreview({
        barId,
        sendTest,
        phone: sendTest ? phone.trim() || undefined : undefined,
      });
      setPreview(response.preview);
      setIntegration(response.integration ?? null);
      if (!silent) {
        if (sendTest) {
          pushToast("Test message requested.", "success");
          setFeedback("Test message request dispatched.");
        } else {
          pushToast("Preview updated.", "success");
          setFeedback("Preview refreshed.");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load preview.";
      setError(message);
      pushToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <label>
          <span>Bar</span>
          <select
            value={barId}
            onChange={(event) => setBarId(event.target.value)}
          >
            {bars.map((bar) => (
              <option key={bar.id} value={bar.id}>
                {bar.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Send test to (optional)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. +250780000000"
            inputMode="tel"
          />
        </label>
      </div>

      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => loadPreview({ sendTest: false })}
          disabled={!barId || isLoading}
        >
          {isLoading ? "Loading…" : "Refresh preview"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => loadPreview({ sendTest: true })}
          disabled={!barId || isLoading || !phone.trim()}
        >
          Send test message
        </Button>
        <IntegrationStatusBadge integration={integration} label="QR preview" />
      </div>

      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {preview
        ? (
          <div className={styles.previewGrid}>
            <div className={styles.card}>
              <h4>Interactive message</h4>
              <div className={styles.messageHeader}>{preview.interactive.header}</div>
              <div className={styles.messageBody}>{preview.interactive.body}</div>
              <div>
                <div className={styles.buttonLabel}>{preview.interactive.buttonLabel}</div>
                <ul className={styles.rowsList}>
                  {preview.interactive.rows.map((row) => (
                    <li key={row.id} className={styles.rowItem}>
                      <strong>{row.title}</strong>
                      {row.description ? <span>{row.description}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={styles.card}>
              <h4>Fallback instructions</h4>
              <ul className={styles.fallbackList}>
                {preview.fallback.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className={styles.card}>
              <h4>Metadata</h4>
              <ul className={styles.metadataList}>
                <li>
                  <strong>Bar</strong>: {preview.metadata.barName}
                  {preview.metadata.barLocation ? ` — ${preview.metadata.barLocation}` : ""}
                </li>
                {preview.metadata.sampleTable
                  ? (
                    <li>
                      <strong>Sample table</strong>: {preview.metadata.sampleTable.label}
                      <br />
                      <code>{preview.metadata.sampleTable.qrPayload}</code>
                    </li>
                  )
                  : (
                    <li>No QR table sample available.</li>
                  )}
                {preview.metadata.shareLink
                  ? (
                    <li>
                      <strong>WhatsApp share link</strong>:{" "}
                      <a href={preview.metadata.shareLink} target="_blank" rel="noopener noreferrer">
                        {preview.metadata.shareLink}
                      </a>
                    </li>
                  )
                  : (
                    <li>WhatsApp share link unavailable.</li>
                  )}
              </ul>
            </div>
          </div>
        )
        : (
          <p className={styles.emptyState}>
            Select a bar and refresh to generate the preview payload.
          </p>
        )}
    </div>
  );
}
