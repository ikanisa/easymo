'use client'

import { WifiIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const t = useTranslations('offline')

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <WifiIcon className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-semibold">{t('title')}</p>
          <p className="text-sm">{t('message')}</p>
        </div>
      </div>
    </div>
  )
}
