'use client'

import { FormEvent,useRef, useState } from 'react'

import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'

export default function MessageInput() {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, isLoading, isTyping } = useChatContext()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isTyping) return

    const message = input.trim()
    setInput('')
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    await sendMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    setInput(target.value)

    // Auto-resize textarea
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
  }

  const isDisabled = isLoading || isTyping

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div
          className={cn(
            'flex-1 relative rounded-2xl border transition-colors',
            isFocused ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300',
            isDisabled && 'opacity-50'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type your message..."
            disabled={isDisabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 resize-none outline-none rounded-2xl text-sm max-h-[120px]"
            style={{ minHeight: '48px' }}
          />
          
          {input.trim() && (
            <div className="absolute right-2 bottom-2 text-xs text-gray-400">
              {input.length}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isDisabled}
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            input.trim() && !isDisabled
              ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>

      <div className="flex items-center justify-between mt-2 px-1">
        <div className="text-xs text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
