import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function OnboardingView() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-primary/10 to-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('onboarding.welcome')}</h1>
          <p className="text-muted-foreground">AI-powered restaurant ordering</p>
        </div>
        
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate('/chat')}
          >
            {t('onboarding.start')}
          </Button>
        </div>
      </div>
    </div>
  )
}
