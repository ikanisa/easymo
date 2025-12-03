"use client";

import { useState } from "react";
import { Smartphone, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CountrySelector } from "./CountrySelector";
import type { SupportedCountryCode } from "@/lib/countries/types";
import {
  COUNTRY_MOMO_BRANDS,
  COUNTRY_PHONE_PREFIXES,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries/types";
import { formatPhoneWithPrefix } from "@/lib/countries/countries-service";

interface MomoSetupFormProps {
  initialCountry?: SupportedCountryCode;
  initialPhone?: string;
  onSave: (data: { countryCode: SupportedCountryCode; phoneNumber: string }) => Promise<void>;
  onCancel?: () => void;
}

export function MomoSetupForm({
  initialCountry = DEFAULT_COUNTRY_CODE,
  initialPhone = "",
  onSave,
  onCancel,
}: MomoSetupFormProps) {
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>(initialCountry);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phonePrefix = COUNTRY_PHONE_PREFIXES[countryCode];
  const provider = COUNTRY_MOMO_BRANDS[countryCode];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits and spaces
    const value = e.target.value.replace(/[^\d\s]/g, "");
    setPhoneNumber(value);
    setError(null);
  };

  const validatePhone = (): boolean => {
    const cleanPhone = phoneNumber.replace(/\s/g, "");
    if (cleanPhone.length < 8) {
      setError("Phone number is too short");
      return false;
    }
    if (cleanPhone.length > 12) {
      setError("Phone number is too long");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhone()) return;

    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneWithPrefix(phoneNumber, countryCode);
      await onSave({ countryCode, phoneNumber: formattedPhone });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Country Selection */}
      <CountrySelector
        value={countryCode}
        onChange={setCountryCode}
        label="Mobile Money Country"
        showProvider={true}
      />

      {/* Phone Number Input */}
      <div>
        <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-2">
          Mobile Money Number
        </label>
        <div className="flex">
          <div className="flex items-center px-4 bg-[var(--aurora-surface-elevated)] border border-r-0 border-[var(--aurora-border)] rounded-l-xl">
            <span className="text-[var(--aurora-text-secondary)] font-medium">
              {phonePrefix}
            </span>
          </div>
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="788 123 456"
            className="flex-1 p-4 bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-r-xl text-[var(--aurora-text-primary)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Provider Info */}
      <div className="flex items-start gap-3 p-4 bg-[var(--aurora-surface-elevated)] rounded-xl">
        <Info className="w-5 h-5 text-[var(--aurora-accent)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
            Provider: {provider}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)] mt-1">
            This is the only mobile money provider available in {countryCode === "CD" ? "DR Congo" : countryCode === "RW" ? "Rwanda" : countryCode === "BI" ? "Burundi" : "Tanzania"}.
            Your number must be registered with {provider}.
          </p>
        </div>
      </div>

      {/* SMS Permission Note */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
        <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
            SMS Permission (Optional)
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)] mt-1">
            SMS reading is optional. If enabled, the app can automatically detect incoming payments.
            You can enable this later in Settings.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !phoneNumber}
          className="flex-1"
        >
          {isLoading ? "Saving..." : "Save Mobile Money Number"}
        </Button>
      </div>
    </form>
  );
}
