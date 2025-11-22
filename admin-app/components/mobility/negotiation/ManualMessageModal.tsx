"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ManualMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { message: string; delaySeconds?: number }) => Promise<void> | void;
  isSubmitting?: boolean;
  defaultMessage?: string;
  recipients: string[];
}

export function ManualMessageModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  defaultMessage,
  recipients,
}: ManualMessageModalProps) {
  const [message, setMessage] = useState(defaultMessage ?? "");
  const [delay, setDelay] = useState<number | "">("");

  useEffect(() => {
    if (isOpen) {
      setMessage(defaultMessage ?? "");
      setDelay("");
    }
  }, [defaultMessage, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    await onSubmit({ message: message.trim(), delaySeconds: typeof delay === "number" ? delay : undefined });
  }

  return (
    <Modal title="Send manual WhatsApp nudge" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
          <p className="font-medium">Recipients</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {recipients.length > 0
              ? recipients.join(", ")
              : "No driver IDs available. This message will not be sent until we have at least one candidate."}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="manual-message" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Message
          </label>
          <textarea
            id="manual-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
            placeholder="Hey! Need a driver near Kigali Convention Centre in 10 minutes. Reply yes if available."
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="manual-delay" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Delay (seconds)
          </label>
          <input
            id="manual-delay"
            type="number"
            min={0}
            placeholder="Send immediately"
            value={delay}
            onChange={(event) => {
              const value = event.target.value;
              setDelay(value === "" ? "" : Number(value));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !message.trim() || recipients.length === 0}>
            {isSubmitting ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
