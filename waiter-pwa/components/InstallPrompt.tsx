'use client'

import { ArrowDownTrayIcon,XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useEffect,useState } from 'react'

import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)
  const t = useTranslations('install')

  // Check if user previously dismissed the prompt
  useEffect(() => {
    const isDismissed = localStorage.getItem('install-prompt-dismissed') === 'true'
    setDismissed(isDismissed)
  }, [])

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (!accepted) {
      localStorage.setItem('install-prompt-dismissed', 'true')
      setDismissed(true)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('install-prompt-dismissed', 'true')
    setDismissed(true)
  }

  if (!isInstallable || isInstalled || dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-4 shadow-2xl">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <ArrowDownTrayIcon className="w-8 h-8 flex-shrink-0" />
          <div>
            <p className="font-bold text-lg">{t('title')}</p>
            <p className="text-sm text-primary-100">{t('message')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors"
          >
            {t('install')}
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
