import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Menu, ShoppingCart, Mic, MicOff } from 'lucide-react'
import { useChat } from '@/contexts/ChatContext'
import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const log = console

export function ChatView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { messages, isTyping, sendMessage } = useChat()
  const { items } = useCart()
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim()) return

    const message = input.trim()
    setInput('')
    
    try {
      await sendMessage(message)
      log.info('[ChatView] Message sent', { length: message.length })
    } catch (error) {
      log.error('[ChatView] Send error', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleVoiceRecording = () => {
    setIsRecording(!isRecording)
    log.info('[ChatView] Voice recording', { isRecording: !isRecording })
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'menu':
        navigate('/menu')
        break
      case 'cart':
        navigate('/cart')
        break
      case 'recommend':
        sendMessage(t('chat.quickActions.recommend') || 'What do you recommend?')
        break
      case 'specials':
        sendMessage(t('chat.quickActions.specials') || "What are today's specials?")
        break
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/menu')}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="text-lg font-semibold">{t('chat.title')}</h1>

        <Button
          variant="ghost"
          size="sm"
          className="relative"
          onClick={() => navigate('/cart')}
        >
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">👋</div>
            <h2 className="text-xl font-semibold mb-2">
              {t('onboarding.welcome')}
            </h2>
            <p className="text-muted-foreground mb-6">
              Ask me anything about the menu, recommendations, or place an order
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {['menu', 'recommend', 'specials', 'cart'].map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                >
                  {action === 'menu' && <Menu className="h-4 w-4 mr-1" />}
                  {action === 'cart' && <ShoppingCart className="h-4 w-4 mr-1" />}
                  {t(`chat.quickActions.${action}`) || action}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>

                <div
                  className={cn(
                    'flex flex-col gap-1 max-w-[80%]',
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                      message.isStreaming && 'animate-pulse'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex space-x-1">
                  <div
                    className="h-2 w-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="h-2 w-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="h-2 w-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm">{t('chat.typing')}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Actions (only show if messages exist) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-card border-t">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['menu', 'cart', 'recommend', 'specials'].map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => handleQuickAction(action)}
              >
                {action === 'menu' && <Menu className="h-4 w-4 mr-1" />}
                {action === 'cart' && <ShoppingCart className="h-4 w-4 mr-1" />}
                {t(`chat.quickActions.${action}`) || action}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-card border-t px-4 py-3 safe-area-inset-bottom">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVoiceRecording}
            className={cn(isRecording && 'text-destructive')}
          >
            {isRecording ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.inputPlaceholder')}
            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isTyping || isRecording}
          />

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            size="sm"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
