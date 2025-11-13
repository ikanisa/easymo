'use client';

import { MenuBrowser } from '@/components/menu/MenuBrowser';
import { MenuProvider } from '@/contexts/MenuContext';
import { CartButton } from '@/components/menu/CartButton';
import { CartModal } from '@/components/menu/CartModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function MenuPage() {
  const t = useTranslations();

  return (
    <MenuProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/chat" className="text-2xl text-gray-700 hover:text-gray-900">
                ←
              </Link>
              <div>
                <h1 className="font-semibold text-lg text-gray-900">{t('menu.title')}</h1>
                <p className="text-xs text-gray-500">{t('menu.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href="/chat"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={t('chat.title')}
              >
                <span className="text-xl">💬</span>
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* Menu Browser */}
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
          <MenuBrowser />
        </div>

        {/* Cart Button (Floating) */}
        <CartButton />

        {/* Cart Modal */}
        <CartModal />
      </div>
    </MenuProvider>
  );
}
