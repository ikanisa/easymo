"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { Button } from "@/components/ui/Button";
import styles from "./VoucherGenerationForm.module.css";

interface ResultEntry {
  voucherId: string;
  msisdn: string;
  status: string;
}

export function VoucherGenerationForm() {
  const [amount, setAmount] = useState(2000);
  const [currency, setCurrency] = useState("RWF");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [recipientsInput, setRecipientsInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [results, setResults] = useState<ResultEntry[] | null>(null);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pushToast } = useToast();

  const parseRecipients = () => {
    const unique = new Set(
      recipientsInput
        .split(/\n|,/) // allow comma or newline separated
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
    return Array.from(unique);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    setResults(null);
    setIntegration(null);

    const parsedRecipients = parseRecipients();
    if (!parsedRecipients.length) {
      const text = "Add at least one recipient MSISDN (one per line).";
      setFeedback(text);
      pushToast(text, "error");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/vouchers/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `voucher-${Date.now()}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          recipients: parsedRecipients.map((value) => ({ msisdn: value })),
        }),
      });

      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        const text = data?.message ?? "Unable to generate voucher.";
        setFeedback(text);
        pushToast(text, "error");
      } else {
        const text = data.message ?? "Voucher generated.";
        setFeedback(text);
        setResults(data.vouchers ?? []);
        pushToast(text, "success");
      }
    } catch (error) {
      console.error("Voucher generation failed", error);
      setFeedback("Unexpected error during voucher generation.");
      pushToast("Unexpected error during voucher generation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.multilineField}>
          <span>Recipient MSISDNs</span>
          <textarea
            required
            value={recipientsInput}
            onChange={(event) => setRecipientsInput(event.target.value)}
            placeholder={"+2507… (one per line)"}
            rows={4}
          />
          <small className={styles.helper}>
            Paste one MSISDN per line or separate with commas.
          </small>
        </label>
        <label>
          <span>Amount</span>
          <input
            type="number"
            min={100}
            step={100}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Currency</span>
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          />
        </label>
        <label>
          <span>Expires at</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        variant="default"
        className="bg-emerald-500 hover:bg-emerald-500/90 text-white"
      >
        {isSubmitting ? "Issuing…" : "Issue voucher"}
      </Button>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Voucher issuance"
          />
        )
        : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
      {results && results.length
        ? (
          <div className={styles.results}>
            <h4>Issued vouchers</h4>
            <ul>
              {results.map((entry) => (
                <li key={entry.voucherId}>
                  <strong>{entry.voucherId}</strong> → {entry.msisdn}{" "}
                  ({entry.status})
                </li>
              ))}
            </ul>
          </div>
        )
        : null}
    </form>
  );
}
