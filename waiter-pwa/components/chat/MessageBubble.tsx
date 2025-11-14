'use client'

import type { Message } from '@/types/chat'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  isLast?: boolean
}

export default function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.sender === 'user'
  const isSystem = message.sender === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div
      data-sender={message.sender}
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-white border border-gray-200 rounded-bl-md'
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤖</span>
            <span className="text-xs font-medium text-gray-600">AI Waiter</span>
          </div>
        )}

        <div
          className={cn(
            'text-sm whitespace-pre-wrap',
            isUser ? 'text-white' : 'text-gray-900'
          )}
        >
          {message.content}
        </div>

        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-primary-100' : 'text-gray-400'
          )}
        >
          {formatTime(message.timestamp || message.created_at)}
        </div>
      </div>
    </div>
  )
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / 60000)

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
