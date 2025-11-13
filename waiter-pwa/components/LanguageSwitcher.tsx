'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { locales, localeNames, type Locale } from '@/i18n'
import { LanguageIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'

export default function LanguageSwitcher() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  
  const currentLocale = (params.locale as Locale) || 'en'

  function changeLocale(newLocale: Locale) {
    if (newLocale === currentLocale) return

    startTransition(() => {
      // Replace the locale in the pathname
      const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`)
      router.replace(newPathname)
    })
  }

  return (
    <div className="relative inline-block text-left">
      <div className="group">
        <button
          type="button"
          className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          disabled={isPending}
        >
          <LanguageIcon className="w-5 h-5 mr-2" />
          {localeNames[currentLocale]}
          <svg
            className="w-5 h-5 ml-2 -mr-1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Dropdown menu */}
        <div className="absolute right-0 z-50 hidden w-48 mt-2 origin-top-right bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 group-hover:block">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => changeLocale(locale)}
                className={`${
                  currentLocale === locale
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                } group flex items-center w-full px-4 py-2 text-sm`}
                role="menuitem"
                disabled={isPending}
              >
                {localeNames[locale]}
                {currentLocale === locale && (
                  <CheckIcon className="w-5 h-5 ml-auto text-primary-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
