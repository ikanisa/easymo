'use client';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { ChatProvider } from '@/contexts/ChatContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function ChatPage() {
  const t = useTranslations();

  return (
    <ChatProvider>
      <div className="min-h-screen flex flex-col bg-white">
        {/* Header */}
        <header className="bg-emerald-500 text-white px-4 py-3 shadow-md">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="text-xl">
                ←
              </Link>
              <div>
                <h1 className="font-semibold text-lg">{t('chat.title')}</h1>
                <p className="text-xs text-emerald-100">{t('chat.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href="/menu"
                className="p-2 hover:bg-emerald-600 rounded-lg transition-colors"
                title={t('menu.title')}
              >
                <span className="text-xl">📋</span>
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* Chat Interface */}
        <div className="flex-1 max-w-2xl w-full mx-auto">
          <ChatInterface />
        </div>
      </div>
    </ChatProvider>
  );
}
