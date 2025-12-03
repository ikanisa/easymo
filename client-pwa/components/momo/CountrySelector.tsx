'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import type { Country, CountrySelectOption } from '@/types/country';
import { fetchCountries, countriesToSelectOptions } from '@/lib/countries';

interface CountrySelectorProps {
  value: string | null;
  onChange: (country: Country) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CountrySelector({
  value,
  onChange,
  label,
  placeholder = 'Select Country',
  disabled = false,
  className,
}: CountrySelectorProps) {
  const { trigger } = useHaptics();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<CountrySelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch countries from Supabase
  useEffect(() => {
    async function loadCountries() {
      try {
        setIsLoading(true);
        setError(null);
        const countries = await fetchCountries();
        setOptions(countriesToSelectOptions(countries));
      } catch (err) {
        setError('Failed to load countries');
        console.error('Error loading countries:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadCountries();
  }, []);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.country.name.toLowerCase().includes(query) ||
        opt.country.code.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleSelect = useCallback(
    (option: CountrySelectOption) => {
      trigger('selection');
      onChange(option.country);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange, trigger]
  );

  const handleToggle = useCallback(() => {
    if (disabled) return;
    trigger('light');
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [disabled, isOpen, trigger]);

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3',
          'bg-card border-2 rounded-xl',
          'text-left transition-colors',
          disabled || isLoading
            ? 'opacity-50 cursor-not-allowed border-muted'
            : 'border-border hover:border-primary/50'
        )}
      >
        {isLoading ? (
          <span className="text-muted-foreground">Loading countries...</span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : selectedOption ? (
          <span className="flex items-center gap-2">
            <span className="text-xl">{selectedOption.country.flagEmoji}</span>
            <span className="font-medium">{selectedOption.country.name}</span>
            <span className="text-muted-foreground">
              ({selectedOption.country.code})
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'w-5 h-5 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'absolute left-0 right-0 mt-2 z-50',
                'bg-card border-2 border-border rounded-xl shadow-lg',
                'max-h-80 overflow-hidden'
              )}
            >
              {/* Search Input */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    className={cn(
                      'w-full pl-10 pr-10 py-2',
                      'bg-background border border-border rounded-lg',
                      'text-sm placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-60 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No countries found
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3',
                        'text-left transition-colors hover:bg-accent',
                        value === option.value && 'bg-primary/5'
                      )}
                    >
                      <span className="text-xl">{option.country.flagEmoji}</span>
                      <div className="flex-1">
                        <div className="font-medium">{option.country.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.country.mobileMoneyBrand} •{' '}
                          {option.country.currencyCode}
                        </div>
                      </div>
                      {value === option.value && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
