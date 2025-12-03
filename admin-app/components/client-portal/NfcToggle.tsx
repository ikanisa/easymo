"use client";

import { useState, useEffect } from "react";
import { Nfc, NfcOff } from "lucide-react";

interface NfcToggleProps {
  onToggle?: (enabled: boolean) => void;
  defaultEnabled?: boolean;
}

export function NfcToggle({ onToggle, defaultEnabled = false }: NfcToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if NFC is supported (only in secure contexts)
    if (typeof window !== "undefined" && "NDEFReader" in window) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const handleToggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    onToggle?.(newValue);
  };

  if (isSupported === null) {
    return null; // Loading state
  }

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between p-4 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl opacity-50">
        <div className="flex items-center gap-3">
          <NfcOff className="w-5 h-5 text-[var(--aurora-text-muted)]" />
          <div>
            <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
              NFC Writer
            </p>
            <p className="text-xs text-[var(--aurora-text-muted)]">
              Not supported on this device
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Nfc className="w-5 h-5 text-[var(--aurora-accent)]" />
        ) : (
          <NfcOff className="w-5 h-5 text-[var(--aurora-text-muted)]" />
        )}
        <div>
          <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
            NFC Writer
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {enabled ? "Ready to write payment tags" : "Tap to enable"}
          </p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled
            ? "bg-[var(--aurora-accent)]"
            : "bg-[var(--aurora-border)]"
        }`}
        aria-label={enabled ? "Disable NFC Writer" : "Enable NFC Writer"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
