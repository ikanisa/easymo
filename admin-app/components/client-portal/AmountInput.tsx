"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { SupportedCountryCode } from "@/lib/countries/types";
import { COUNTRY_CURRENCIES } from "@/lib/countries/types";

interface AmountInputProps {
  countryCode: SupportedCountryCode;
  onAmountChange?: (amount: number) => void;
  initialAmount?: number;
}

export function AmountInput({
  countryCode,
  onAmountChange,
  initialAmount = 0,
}: AmountInputProps) {
  const [amount, setAmount] = useState(initialAmount.toString());
  const [showKeyboard, setShowKeyboard] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const currency = COUNTRY_CURRENCIES[countryCode];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowKeyboard(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setAmount((prev) => {
        const newAmount = prev.slice(0, -1) || "0";
        onAmountChange?.(parseInt(newAmount, 10) || 0);
        return newAmount;
      });
    } else if (key === "clear") {
      setAmount("0");
      onAmountChange?.(0);
    } else {
      setAmount((prev) => {
        const newAmount = prev === "0" ? key : prev + key;
        // Limit to reasonable amount (10 digits)
        if (newAmount.length > 10) return prev;
        onAmountChange?.(parseInt(newAmount, 10) || 0);
        return newAmount;
      });
    }
  };

  const formatDisplayAmount = (value: string): string => {
    const num = parseInt(value, 10) || 0;
    return num.toLocaleString();
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"],
  ];

  return (
    <div ref={inputRef} className="w-full">
      {/* Amount Display */}
      <button
        type="button"
        onClick={() => setShowKeyboard(true)}
        className="w-full p-6 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl text-center transition-colors hover:bg-[var(--aurora-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]"
      >
        <p className="text-xs text-[var(--aurora-text-muted)] mb-1">
          Amount to Receive
        </p>
        <p className="text-3xl font-bold text-[var(--aurora-text-primary)]">
          {currency} {formatDisplayAmount(amount)}
        </p>
        {!showKeyboard && (
          <p className="text-xs text-[var(--aurora-text-muted)] mt-2">
            Tap to enter amount
          </p>
        )}
      </button>

      {/* Dynamic Keyboard */}
      {showKeyboard && (
        <div className="mt-4 p-4 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl">
          <div className="grid grid-cols-3 gap-2">
            {keys.map((row, rowIndex) =>
              row.map((key) => (
                <button
                  key={`${rowIndex}-${key}`}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  className={`p-4 rounded-lg text-lg font-medium transition-colors ${
                    key === "clear"
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : key === "backspace"
                      ? "bg-[var(--aurora-surface-elevated)] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-border)]"
                      : "bg-[var(--aurora-surface-elevated)] text-[var(--aurora-text-primary)] hover:bg-[var(--aurora-border)]"
                  }`}
                >
                  {key === "backspace" ? (
                    <X className="w-5 h-5 mx-auto" />
                  ) : key === "clear" ? (
                    "C"
                  ) : (
                    key
                  )}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowKeyboard(false)}
            className="w-full mt-3 p-3 bg-[var(--aurora-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
