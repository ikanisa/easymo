"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import type { InsuranceQuote } from "@/lib/schemas";

import styles from "./InsuranceDrawer.module.css";

interface InsuranceDrawerProps {
  quote: InsuranceQuote;
  onClose: () => void;
  onApprove?: (
    quoteId: string,
  ) => Promise<
    | { status?: string; message?: string; integration?: unknown }
    | void
  >;
  onRequestChanges?: (
    quoteId: string,
    comment: string,
  ) => Promise<
    | { status?: string; message?: string; integration?: unknown }
    | void
  >;
  onUpdateStatus?: (
    quoteId: string,
    status: string,
    reviewerComment?: string | null,
  ) => Promise<unknown>;
  approving?: boolean;
  requesting?: boolean;
  updating?: boolean;
}

export function InsuranceDrawer({
  quote,
  onClose,
  onApprove,
  onRequestChanges,
  onUpdateStatus,
  approving,
  requesting,
  updating,
}: InsuranceDrawerProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const [comment, setComment] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);

  const approve = async () => {
    if (!onApprove) {
      setStatusMessage("Approval action unavailable.");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    setIntegration(null);
    try {
      const result = await onApprove(quote.id);
      const message = (result as any)?.message ?? "Quote approved.";
      setStatusMessage(message);
      setIntegration((result as any)?.integration ?? null);
    } catch (error) {
      console.error("Approve quote failed", error);
      setStatusMessage("Unexpected error while approving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestChanges = async () => {
    if (!onRequestChanges) {
      setStatusMessage("Request changes action unavailable.");
      return;
    }
    if (!comment.trim()) {
      setStatusMessage("Provide a comment before requesting changes.");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    setIntegration(null);
    try {
      const result = await onRequestChanges(quote.id, comment);
      const message = (result as any)?.message ?? "Change request recorded.";
      setStatusMessage(message);
      setIntegration((result as any)?.integration ?? null);
      setComment("");
    } catch (error) {
      console.error("Request changes failed", error);
      setStatusMessage("Unexpected error while requesting changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer title={`Insurance quote ${quote.id}`} onClose={onClose}>
      <div className={styles.section}>
        <h3>Status</h3>
          <p className="capitalize">{quote.status}</p>
          {onUpdateStatus
            ? (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || updating}
                  onClick={() => onUpdateStatus(quote.id, "pending", comment || null)}
                >
                  Mark pending
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || updating}
                  onClick={() => onUpdateStatus(quote.id, "approved", comment || null)}
                >
                  Mark approved
                </Button>
              </div>
            )
            : null}
      </div>
      <div className={styles.section}>
        <h3>Premium</h3>
        <p>
          {quote.premium
            ? `${quote.premium.toLocaleString()} RWF`
            : "Pending pricing"}
        </p>
      </div>
      <div className={styles.section}>
        <h3>Documents</h3>
        <ul>
          {quote.uploadedDocs.map((doc) => <li key={doc}>{doc}</li>)}
        </ul>
      </div>
      <div className={styles.section}>
        <h3>Actions</h3>
        <div className={styles.actions}>
          <Button
            type="button"
            onClick={() => setConfirmApprove(true)}
            disabled={isSubmitting || approving}
            title="Approve this insurance quote"
          >
            {approving ? "Approving…" : "Approve"}
          </Button>
          <Button
            type="button"
            onClick={requestChanges}
            disabled={isSubmitting || requesting}
            variant="danger"
          >
            {requesting ? "Sending…" : "Request changes"}
          </Button>
        </div>
        <label className={styles.commentField}>
          <span>Reviewer comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Explain what needs to change"
            rows={3}
            disabled={isSubmitting}
          />
        </label>
      </div>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Insurance workflow"
          />
        )
        : null}
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
