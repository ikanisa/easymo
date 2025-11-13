'use client'

import { useEffect, useRef } from 'react'
import { useChatContext } from '@/contexts/ChatContext'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import { cn } from '@/lib/utils'

export default function MessageList() {
  const { messages, isTyping } = useChatContext()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400">
          <p className="text-center">
            Start a conversation with your AI waiter
          </p>
        </div>
      )}

      {messages.map((message, index) => (
        <MessageBubble
          key={message.id || index}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}

      {isTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
