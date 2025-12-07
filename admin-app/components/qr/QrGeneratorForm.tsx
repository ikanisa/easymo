"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";
import type { Bar } from "@/lib/schemas";
import { QrRangeGenerator } from "./QrRangeGenerator";
import { QrBatchDownloader } from "./QrBatchDownloader";

import styles from "./QrGeneratorForm.module.css";

interface QrGeneratorFormProps {
  bars: Bar[];
}

interface TokenResult {
  id: string;
  stationId: string;
  barName: string;
  tableLabel: string;
  token: string;
  createdAt: string;
  printed: boolean;
  lastScanAt: string | null;
  qrImageUrl?: string | null;
  whatsappDeepLink?: string | null;
}

export function QrGeneratorForm({ bars }: QrGeneratorFormProps) {
  const [barId, setBarId] = useState(bars[0]?.id ?? "");
  const [tableLabels, setTableLabels] = useState("Table 1");
  const [batchCount, setBatchCount] = useState(1);
  const [tokens, setTokens] = useState<TokenResult[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRangeGenerator, setShowRangeGenerator] = useState(false);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const { pushToast } = useToast();

  const selectedBar = bars.find((bar) => bar.id === barId);

  const handleRangeGenerate = (labels: string) => {
    setTableLabels(labels);
    setShowRangeGenerator(false);
    pushToast(`Generated labels: ${labels.split(',').length} tables`, 'success');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBar) return;
    setIsSubmitting(true);
    setFeedback(null);
    setTokens(null);
    setIntegration(null);

    try {
      const response = await fetch(getAdminApiPath("qr", "generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `qr-${Date.now()}`,
        },
        body: JSON.stringify({
          stationId: selectedBar.id,
          tableLabels: tableLabels
            .split(",")
            .map((label) => label.trim())
            .filter(Boolean),
          batchCount,
        }),
      });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        const text = data?.error ?? "Failed to generate QR tokens.";
        setFeedback(text);
        pushToast(text, "error");
      } else {
        setTokens(data.tokens ?? []);
        const text = `Generated ${data.tokens?.length ?? 0} QR tokens.`;
        setFeedback(text);
        pushToast(text, "success");
      }
    } catch (error) {
      console.error("QR generate failed", error);
      setFeedback("Unexpected error while generating QR tokens.");
      pushToast("Unexpected error while generating QR tokens.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
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
          <span>Table labels (comma separated)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={tableLabels}
              onChange={(event) => setTableLabels(event.target.value)}
              placeholder="Table 1, Table 2, Table 3"
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              onClick={() => setShowRangeGenerator(!showRangeGenerator)}
              variant="outline"
              style={{ whiteSpace: 'nowrap' }}
            >
              {showRangeGenerator ? 'Hide Range' : 'Generate Range'}
            </Button>
          </div>
        </label>
        {showRangeGenerator && (
          <div style={{ marginTop: '12px' }}>
            <QrRangeGenerator onGenerate={handleRangeGenerate} />
          </div>
        )}
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
      <Button
        type="submit"
        disabled={isSubmitting || !selectedBar}
        variant="outline"
      >
        {isSubmitting ? "Generating…" : "Generate tokens"}
      </Button>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="QR generator"
          />
        )
        : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
      {tokens && tokens.length
        ? (
          <div className={styles.results}>
            <h4>Generated tokens</h4>
            
            {/* Add batch downloader if QR images exist */}
            {tokens.some(t => t.qrImageUrl) && (
              <div style={{ marginBottom: '16px' }}>
                <QrBatchDownloader 
                  tokens={tokens.map(t => ({
                    id: t.id,
                    tableLabel: t.tableLabel,
                    token: t.token,
                    qrImageUrl: t.qrImageUrl
                  }))}
                  barName={selectedBar?.name ?? 'Bar'}
                />
              </div>
            )}
            
            <ul>
              {tokens.map((token) => (
                <li key={token.id}>
                  <strong>{token.token}</strong> – {token.tableLabel}{" "}
                  ({new Date(token.createdAt).toLocaleString()})
                  {token.qrImageUrl && (
                    <span style={{ marginLeft: '8px', color: 'green', fontSize: '12px' }}>
                      ✓ QR Image
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
        : null}
    </form>
  );
}
