import { useState, useEffect } from 'react'

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const showInstallPrompt = () => {
    if (canInstall) {
      console.log('Show install prompt')
    }
  }

  return { canInstall, showInstallPrompt, isInstalled: false }
}
