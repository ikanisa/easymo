'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // User already has a session, redirect to chat
        router.push(`/${locale}/chat`);
      } else {
        setIsLoading(false);
      }
    });

    // Check for QR code parameters
    const params = new URLSearchParams(window.location.search);
    const venue = params.get('venue');
    const table = params.get('table');
    
    if (venue) {
      localStorage.setItem('venue_id', venue);
    }
    if (table) {
      setTableNumber(table);
      localStorage.setItem('table_number', table);
    }
  }, [router, supabase.auth, locale]);

  const handleStart = async () => {
    setIsLoading(true);

    try {
      // Sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      // Store user preferences
      if (userName) {
        localStorage.setItem('user_name', userName);
      }
      if (tableNumber) {
        localStorage.setItem('table_number', tableNumber);
      }

      // Redirect to chat
      router.push(`/${locale}/chat`);
    } catch (error) {
      console.error('Error starting session:', error);
      setIsLoading(false);
      setError(t('common.error'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center">
              <span className="text-5xl">🍽️</span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {t('onboarding.title')}
            </h1>
            <p className="text-lg text-gray-600">
              {t('onboarding.subtitle')}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 text-left mb-1">
                {t('onboarding.nameLabel')} ({t('common.optional')})
              </label>
              <input
                type="text"
                id="name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={t('onboarding.namePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="table" className="block text-sm font-medium text-gray-700 text-left mb-1">
                {t('onboarding.tableLabel')} ({t('common.optional')})
              </label>
              <input
                type="text"
                id="table"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder={t('onboarding.tablePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('onboarding.startButton')}
            </button>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="pt-8 space-y-3 text-left">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">💬</span>
              <div>
                <h3 className="font-semibold text-gray-900">{t('onboarding.feature1Title')}</h3>
                <p className="text-sm text-gray-600">{t('onboarding.feature1Desc')}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📱</span>
              <div>
                <h3 className="font-semibold text-gray-900">{t('onboarding.feature2Title')}</h3>
                <p className="text-sm text-gray-600">{t('onboarding.feature2Desc')}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🚀</span>
              <div>
                <h3 className="font-semibold text-gray-900">{t('onboarding.feature3Title')}</h3>
                <p className="text-sm text-gray-600">{t('onboarding.feature3Desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
