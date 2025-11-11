"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface CrudDialogProps<FormValues> {
  open: boolean;
  mode: "create" | "edit";
  entityName: string;
  description?: string;
  initialValues: FormValues;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  renderFields: (props: {
    values: FormValues;
    onChange: (updates: Partial<FormValues>) => void;
  }) => ReactNode;
  onDelete?: () => Promise<void>;
}

export function CrudDialog<FormValues>({
  open,
  mode,
  entityName,
  description,
  initialValues,
  onClose,
  onSubmit,
  renderFields,
  onDelete,
}: CrudDialogProps<FormValues>) {
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
    }
  }, [initialValues, open]);

  const title = useMemo(() => {
    return `${mode === "create" ? "Create" : "Edit"} ${entityName}`;
  }, [entityName, mode]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal title={title} onClose={onClose} width="min(520px, 92vw)">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {description ? (
            <p className="text-sm text-gray-600">{description}</p>
          ) : null}
          <div className="space-y-4">
            {renderFields({
              values,
              onChange: (updates) => setValues((prev) => ({ ...prev, ...updates })),
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={submitting || deleting}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
      {onDelete ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDelete}
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          destructive
          title={`Delete ${entityName}`}
          description={`This will permanently remove the ${entityName.toLowerCase()}. You can undo from the toast.`}
        />
      ) : null}
    </>
  );
}
