export function requestNotificationPermission() {
  if (typeof window === 'undefined') return
  
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission()
  }
}

export function playNotificationSound() {
  if (typeof window === 'undefined') return
  
  const audio = new Audio("/sounds/notification.mp3")
  audio.volume = 0.7
  audio.play().catch(() => {
    // Browser may block autoplay
  })
}

export function showDesktopNotification(
  title: string,
  body: string,
  options?: NotificationOptions
) {
  if (typeof window === 'undefined') return null
  
  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: "order-notification",
      requireInteraction: true,
      ...options,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    return notification
  }
  return null
}
