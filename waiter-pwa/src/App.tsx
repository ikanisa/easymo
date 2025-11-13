import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/toaster'
import { SupabaseProvider } from '@/contexts/SupabaseContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { CartProvider } from '@/contexts/CartContext'
import { OnboardingView } from '@/views/OnboardingView'
import { ChatView } from '@/views/ChatView'
import { MenuView } from '@/views/MenuView'
import { CartView } from '@/views/CartView'
import { PaymentView } from '@/views/PaymentView'
import { OrderStatusView } from '@/views/OrderStatusView'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const log = console

export default function App() {
  const { i18n } = useTranslation()
  const isOnline = useOnlineStatus()
  const { showInstallPrompt } = useInstallPrompt()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const venueId = params.get('venue')
        const tableNumber = params.get('table')
        const lang = params.get('lang')

        if (lang && ['en', 'fr', 'es', 'pt', 'de'].includes(lang)) {
          await i18n.changeLanguage(lang)
        }

        log.info('[App] Initialized', {
          venueId,
          tableNumber,
          language: i18n.language,
          isOnline
        })

        setIsInitialized(true)

        setTimeout(showInstallPrompt, 30000)
      } catch (error) {
        log.error('[App] Init error', error)
        setIsInitialized(true)
      }
    }

    init()
  }, [])

  if (!isInitialized) {
    return <LoadingScreen />
  }

  return (
    <SupabaseProvider>
      <ChatProvider>
        <CartProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/onboarding" element={<OnboardingView />} />
                <Route path="/chat" element={<ChatView />} />
                <Route path="/menu" element={<MenuView />} />
                <Route path="/cart" element={<CartView />} />
                <Route path="/payment" element={<PaymentView />} />
                <Route path="/order/:orderId" element={<OrderStatusView />} />
                <Route path="/" element={<Navigate to="/onboarding" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </CartProvider>
      </ChatProvider>
    </SupabaseProvider>
  )
}
