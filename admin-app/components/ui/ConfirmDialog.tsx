'use client';

import { Modal } from '@/components/ui/Modal';
import styles from './ConfirmDialog.module.css';

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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Modal title={title} onClose={onCancel} width="min(420px, 90vw)">
      {description ? <p className={styles.description}>{description}</p> : null}
      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={destructive ? styles.destructiveButton : styles.confirmButton}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

