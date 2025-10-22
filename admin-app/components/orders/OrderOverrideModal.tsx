"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Order } from "@/lib/schemas";
import styles from "./OrderOverrideModal.module.css";
import { useToast } from "@/components/ui/ToastProvider";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { getAdminApiPath } from "@/lib/routes";

interface OrderOverrideModalProps {
  order: Order;
  onClose: () => void;
}

export function OrderOverrideModal(
  { order, onClose }: OrderOverrideModalProps,
) {
  const [reason, setReason] = useState("Vendor unreachable");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const [pendingAction, setPendingAction] = useState<
    "cancel" | "reopen" | null
  >(null);
  const { pushToast } = useToast();

  const runAction = async (action: "cancel" | "nudge" | "reopen") => {
    setIsSubmitting(true);
    setMessage(null);
    setIntegration(null);
    try {
      const response = await fetch(getAdminApiPath("orders", order.id, "override"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json();
      setIntegration(data?.integration ?? null);
      if (!response.ok) {
        const text = data?.error ?? "Override failed.";
        setMessage(text);
        pushToast(text, "error");
      } else {
        const text = data.message ?? "Override applied.";
        setMessage(text);
        pushToast(text, "success");
      }
    } catch (error) {
      console.error("Order override failed", error);
      setMessage("Unexpected error while applying override.");
      pushToast("Unexpected error while applying override.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionRequest = (action: "cancel" | "nudge" | "reopen") => {
    if (action === "nudge") {
      runAction(action);
      return;
    }
    setPendingAction(action);
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    await runAction(pendingAction);
    setPendingAction(null);
  };

  return (
    <Modal title={`Override order ${order.id}`} onClose={onClose}>
      <div className={styles.section}>
        <p>
          <strong>Status:</strong> {order.status}
        </p>
        <p>
          <strong>Total:</strong> {order.total.toLocaleString()} RWF
        </p>
      </div>
      <div className={styles.section}>
        <label>
          <span>Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => handleActionRequest("nudge")}
          disabled={isSubmitting}
          title="Send a reminder to the vendor"
          variant="outline"
          size="sm"
        >
          Nudge vendor
        </Button>
        <Button
          type="button"
          onClick={() => handleActionRequest("cancel")}
          disabled={isSubmitting}
          title="Cancel this order"
          variant="danger"
          size="sm"
        >
          Cancel order
        </Button>
        <Button
          type="button"
          onClick={() => handleActionRequest("reopen")}
          disabled={isSubmitting}
          title="Return this order to pending"
          variant="subtle"
          size="sm"
        >
          Reopen order
        </Button>
      </div>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Order override"
          />
        )
        : null}
      {message ? <p className={styles.message}>{message}</p> : null}
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === "cancel" ? "Cancel order?" : "Reopen order?"}
        description={pendingAction === "cancel"
          ? "Cancelling will notify downstream systems and the vendor. This cannot be undone."
          : "Reopening returns the order to pending and restarts SLA tracking."}
        confirmLabel={pendingAction === "cancel"
          ? "Yes, cancel"
          : "Yes, reopen"}
        cancelLabel="Keep current state"
        destructive={pendingAction === "cancel"}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </Modal>
  );
}
