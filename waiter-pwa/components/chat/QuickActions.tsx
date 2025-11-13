'use client'

import { useChatContext } from '@/contexts/ChatContext'
import type { QuickAction } from '@/types/chat'

const quickActions: QuickAction[] = [
  { id: 'menu', label: '📋 View Menu', action: 'I want to see the menu' },
  { id: 'specials', label: '⭐ Today\'s Special', action: 'What are today\'s specials?' },
  { id: 'cart', label: '🛒 My Cart', action: 'Show me my cart' },
  { id: 'wine', label: '🍷 Wine Pairing', action: 'Recommend a wine' },
  { id: 'allergies', label: '🚫 Dietary Info', action: 'I have dietary restrictions' },
  { id: 'ready', label: '✅ Ready to Order', action: 'I\'m ready to place my order' },
]

export default function QuickActions() {
  const { sendMessage, isLoading, isTyping } = useChatContext()

  const handleAction = async (action: QuickAction) => {
    if (isLoading || isTyping) return
    await sendMessage(action.action, { quick_action: action.id })
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium text-gray-600 mb-3">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={isLoading || isTyping}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
