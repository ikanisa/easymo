'use client'

import { Suspense } from 'react'
import { ChatProvider } from '@/contexts/ChatContext'
import ChatInterface from '@/components/chat/ChatInterface'

export default function ChatPage() {
  return (
    <ChatProvider>
      <Suspense fallback={<LoadingFallback />}>
        <ChatInterface />
      </Suspense>
    </ChatProvider>
  )
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
