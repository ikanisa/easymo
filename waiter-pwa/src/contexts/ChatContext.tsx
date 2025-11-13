import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useSupabase } from './SupabaseContext'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'

const log = console

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
  isStreaming?: boolean
}

interface ChatContextType {
  messages: Message[]
  conversationId: string | null
  isTyping: boolean
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { supabase, userId, realtimeChannel } = useSupabase()
  const { i18n } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!userId) return

    const initConversation = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const venue = params.get('venue')
        const table = params.get('table')

        // Check if there's an existing conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, messages(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingConv) {
          setConversationId(existingConv.id)
          // Load existing messages if any
          if (existingConv.messages && Array.isArray(existingConv.messages)) {
            const loadedMessages = existingConv.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.sender,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              metadata: msg.metadata,
            }))
            setMessages(loadedMessages)
          }
          return
        }

        // Create new conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            restaurant_id: venue,
            table_number: table,
            language: i18n.language,
            metadata: { source: 'pwa', venue, table },
          })
          .select()
          .single()

        if (error) throw error

        setConversationId(newConv.id)

        // Add welcome message
        const welcomeMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: i18n.language === 'fr'
            ? "Bonjour! Je suis votre serveur virtuel. Comment puis-je vous aider aujourd'hui?"
            : "Hello! I'm your virtual waiter. How may I assist you today?",
          timestamp: new Date(),
        }
        setMessages([welcomeMsg])

        log.info('[Chat] Conversation started', { conversationId: newConv.id })
      } catch (error) {
        log.error('[Chat] Init error', error)
      }
    }

    initConversation()
  }, [userId, supabase, i18n.language])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!realtimeChannel || !conversationId) return

    const channel = realtimeChannel
      .on('broadcast', { event: 'agent_response' }, (payload) => {
        if (payload.conversationId !== conversationId) return

        if (payload.type === 'stream_chunk') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + payload.content },
              ]
            }
            return prev
          })
        } else if (payload.type === 'stream_end') {
          setIsTyping(false)
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }]
            }
            return prev
          })
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [realtimeChannel, conversationId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !userId) {
        log.warn('[Chat] No conversation or user')
        return
      }

      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      const placeholderMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, placeholderMessage])
      setIsTyping(true)

      try {
        // Call agent-chat edge function
        const { data, error } = await supabase.functions.invoke('agent-chat', {
          body: {
            agent_kind: 'mobility', // or appropriate agent type
            message: content,
            session_id: conversationId,
          },
        })

        if (error) throw error

        setIsTyping(false)

        // Update placeholder with response
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: data?.messages?.[data.messages.length - 1]?.text || 
                    'I received your message. How can I help further?',
            isStreaming: false,
            metadata: data?.metadata,
          }
          return updated
        })

        log.info('[Chat] Message sent successfully')
      } catch (error) {
        log.error('[Chat] Send error', error)
        setIsTyping(false)
        
        // Show error message
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            id: uuidv4(),
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          },
        ])
      }
    },
    [conversationId, userId, supabase]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return (
    <ChatContext.Provider
      value={{
        messages,
        conversationId,
        isTyping,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) throw new Error('useChat must be used within ChatProvider')
  return context
}
