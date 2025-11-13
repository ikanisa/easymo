'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useChatContext } from '@/contexts/ChatContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import QuickActions from './QuickActions'
import { cn } from '@/lib/utils'

function ChatInterface() {
  const { conversation, createConversation, isLoading, error, clearError } = useChatContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [showQuickActions, setShowQuickActions] = useState(true)

  useEffect(() => {
    // Get params from URL
    const language = searchParams.get('lang') || 'en'
    const tableNumber = searchParams.get('table') || undefined

    // Create conversation if not exists
    if (!conversation && !isLoading) {
      createConversation(language, tableNumber)
    }
  }, [conversation, searchParams, createConversation, isLoading])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6">
        <div className="text-red-600 mb-4">❌ {error}</div>
        <button
          onClick={clearError}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (isLoading && !conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Starting conversation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.push('/')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="font-semibold text-gray-900">AI Waiter</h1>
            <p className="text-xs text-gray-500">
              {conversation?.table_number ? `Table ${conversation.table_number}` : 'Online'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className={cn(
            'p-2 rounded-full transition-colors',
            showQuickActions ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100'
          )}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <MessageList />

      {/* Quick Actions (collapsible) */}
      {showQuickActions && <QuickActions />}

      {/* Input */}
      <MessageInput />
    </div>
  )
}

export { ChatInterface }
export default ChatInterface
