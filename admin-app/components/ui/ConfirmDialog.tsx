"use client";

import { Modal } from "@/components/ui/Modal";
import styles from "./ConfirmDialog.module.css";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onCancel} width="min(420px, 90vw)">
      {description ? <p className={styles.description}>{description}</p> : null}
      <div className={styles.actions}>
        <Button type="button" onClick={onCancel} variant="outline" size="sm">
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          variant={destructive ? "danger" : "outline"}
          size="sm"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
