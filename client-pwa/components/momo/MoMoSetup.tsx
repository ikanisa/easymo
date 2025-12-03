'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Check, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CountrySelector } from './CountrySelector';
import type { Country, UserMoMoConfig } from '@/types/country';
import { getCountryByCode, getMoMoProviderForCountry } from '@/lib/countries';

interface MoMoSetupProps {
  profileCountry: string; // From WhatsApp registration
  currentConfig?: UserMoMoConfig | null;
  onSave: (config: UserMoMoConfig) => Promise<void>;
  onCancel?: () => void;
}

export function MoMoSetup({
  profileCountry,
  currentConfig,
  onSave,
  onCancel,
}: MoMoSetupProps) {
  const { trigger } = useHaptics();
  const [useSameCountry, setUseSameCountry] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [providerInfo, setProviderInfo] = useState<{
    provider: string;
    brand: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileCountryData, setProfileCountryData] = useState<Country | null>(null);

  // Load profile country data
  useEffect(() => {
    async function loadProfileCountry() {
      if (profileCountry) {
        const country = await getCountryByCode(profileCountry);
        setProfileCountryData(country);
        
        // If using same country, set it as selected
        if (useSameCountry && country) {
          setSelectedCountry(country);
        }
      }
    }
    loadProfileCountry();
  }, [profileCountry, useSameCountry]);

  // Load existing config
  useEffect(() => {
    if (currentConfig) {
      setPhoneNumber(currentConfig.momoNumber || '');
      setUseSameCountry(currentConfig.momoCountry === currentConfig.profileCountry);
      
      // Load selected country
      getCountryByCode(currentConfig.momoCountry).then((country) => {
        if (country) {
          setSelectedCountry(country);
        }
      });
    }
  }, [currentConfig]);

  // Load provider info when country changes
  useEffect(() => {
    async function loadProvider() {
      if (selectedCountry) {
        setIsLoading(true);
        const provider = await getMoMoProviderForCountry(selectedCountry.code);
        setProviderInfo(provider ? { provider: provider.provider, brand: provider.brand } : null);
        setIsLoading(false);
      } else {
        setProviderInfo(null);
      }
    }
    loadProvider();
  }, [selectedCountry]);

  const handleCountryChange = useCallback((country: Country) => {
    setSelectedCountry(country);
    setError(null);
    trigger('selection');
  }, [trigger]);

  const handleUseSameCountryChange = useCallback(
    (same: boolean) => {
      setUseSameCountry(same);
      trigger('light');
      
      if (same && profileCountryData) {
        setSelectedCountry(profileCountryData);
      } else {
        setSelectedCountry(null);
      }
    },
    [profileCountryData, trigger]
  );

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!selectedCountry) return false;
    
    // Basic validation: remove non-digits and check length
    const digits = phone.replace(/\D/g, '');
    const prefix = selectedCountry.phonePrefix.replace(/\D/g, '');
    
    // Phone should be at least 8 digits after country code
    if (digits.startsWith(prefix)) {
      return digits.length >= prefix.length + 8;
    }
    
    // Or local format without country code (at least 9 digits)
    return digits.length >= 9;
  }, [selectedCountry]);

  const handleSave = useCallback(async () => {
    if (!selectedCountry) {
      setError('Please select a country');
      trigger('error');
      return;
    }

    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number');
      trigger('error');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        profileCountry,
        momoCountry: selectedCountry.code,
        momoNumber: phoneNumber,
        momoProvider: selectedCountry.mobileMoneyProvider,
      });
      
      trigger('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      trigger('error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedCountry, phoneNumber, profileCountry, validatePhoneNumber, onSave, trigger]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Mobile Money Setup</h2>
          <p className="text-sm text-muted-foreground">
            Configure your mobile money account
          </p>
        </div>
      </div>

      {/* Profile Country Info */}
      {profileCountryData && (
        <div className="p-4 rounded-xl bg-accent/50 border border-border">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Your Profile Country</p>
              <p className="text-sm text-muted-foreground mt-1">
                {profileCountryData.flagEmoji} {profileCountryData.name} (from WhatsApp registration)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Country Selection Type */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Mobile Money Country</label>
        
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleUseSameCountryChange(true)}
            disabled={!profileCountryData}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              useSameCountry
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                useSameCountry ? 'border-primary bg-primary' : 'border-muted-foreground'
              )}
            >
              {useSameCountry && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            <div>
              <p className="font-medium">Use same as profile country</p>
              {profileCountryData && (
                <p className="text-sm text-muted-foreground">
                  {profileCountryData.flagEmoji} {profileCountryData.name}
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleUseSameCountryChange(false)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              !useSameCountry
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                !useSameCountry ? 'border-primary bg-primary' : 'border-muted-foreground'
              )}
            >
              {!useSameCountry && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            <div>
              <p className="font-medium">Use a different country</p>
              <p className="text-sm text-muted-foreground">
                Select from available countries
              </p>
            </div>
          </button>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          Your mobile money country can be different from your WhatsApp country
        </p>
      </div>

      {/* Country Selector (when using different country) */}
      {!useSameCountry && (
        <CountrySelector
          value={selectedCountry?.code ?? null}
          onChange={handleCountryChange}
          label="Select Mobile Money Country"
          placeholder="Choose a country..."
        />
      )}

      {/* Provider Info (auto-determined) */}
      {selectedCountry && providerInfo && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Provider</label>
          <div className="p-4 rounded-xl bg-accent/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">{providerInfo.brand}</p>
                <p className="text-xs text-muted-foreground">
                  {providerInfo.provider}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Provider is determined by your selected country
            </p>
          </div>
        </div>
      )}

      {/* Phone Number Input */}
      {selectedCountry && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Phone Number
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              {selectedCountry.phonePrefix}
            </span>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPhoneNumber(e.target.value);
                setError(null);
              }}
              placeholder="Enter your number"
              className="pl-16"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your {providerInfo?.brand || 'mobile money'} number
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving || !selectedCountry || !phoneNumber}
          className="flex-1"
        >
          {isSaving ? 'Saving...' : 'Save Setup'}
        </Button>
      </div>
    </motion.div>
  );
}
