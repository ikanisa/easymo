"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { SupportedCountryCode } from "@/lib/countries/types";
import {
  COUNTRY_FLAGS,
  COUNTRY_MOMO_BRANDS,
  COUNTRY_NAMES,
  SUPPORTED_COUNTRY_CODES,
} from "@/lib/countries/types";

interface CountrySelectorProps {
  value: SupportedCountryCode;
  onChange: (code: SupportedCountryCode) => void;
  label?: string;
  showProvider?: boolean;
  disabled?: boolean;
}

export function CountrySelector({
  value,
  onChange,
  label = "Select Country",
  showProvider = true,
  disabled = false,
}: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCountry = {
    code: value,
    name: COUNTRY_NAMES[value],
    flag: COUNTRY_FLAGS[value],
    provider: COUNTRY_MOMO_BRANDS[value],
  };

  const handleSelect = (code: SupportedCountryCode) => {
    onChange(code);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-2">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-4 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[var(--aurora-surface-elevated)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedCountry.flag}</span>
          <div className="text-left">
            <p className="font-medium text-[var(--aurora-text-primary)]">
              {selectedCountry.name}
            </p>
            {showProvider && (
              <p className="text-xs text-[var(--aurora-text-muted)]">
                {selectedCountry.provider}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[var(--aurora-text-muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl shadow-lg overflow-hidden">
          {SUPPORTED_COUNTRY_CODES.map((code) => {
            const isSelected = code === value;
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleSelect(code)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${
                  isSelected
                    ? "bg-[var(--aurora-accent)]/10"
                    : "hover:bg-[var(--aurora-surface-elevated)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{COUNTRY_FLAGS[code]}</span>
                  <div className="text-left">
                    <p className="font-medium text-[var(--aurora-text-primary)]">
                      {COUNTRY_NAMES[code]}
                    </p>
                    {showProvider && (
                      <p className="text-xs text-[var(--aurora-text-muted)]">
                        {COUNTRY_MOMO_BRANDS[code]}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-5 h-5 text-[var(--aurora-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
