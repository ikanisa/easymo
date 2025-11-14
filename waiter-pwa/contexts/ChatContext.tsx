'use client'

import { createContext, useContext, useCallback, useReducer, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Message, Conversation, ChatState } from '@/types/chat'
import {
  createConversationInsert,
  createMessageInsert,
  mergeMessages,
  normalizeConversation,
  normalizeMessage,
  type MessageRow,
} from './chat-helpers'

interface ChatContextType extends ChatState {
  sendMessage: (content: string, metadata?: Record<string, any>) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  createConversation: (language?: string, tableNumber?: string) => Promise<void>
  clearError: () => void
}

type ChatAction =
  | { type: 'SET_CONVERSATION'; payload: Conversation }
  | { type: 'UPSERT_MESSAGE'; payload: Message }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'CLEAR_ERROR' }

const initialState: ChatState = {
  conversation: null,
  messages: [],
  isLoading: false,
  error: null,
  isTyping: false,
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CONVERSATION':
      return { ...state, conversation: action.payload }
    case 'UPSERT_MESSAGE':
      return { ...state, messages: mergeMessages(state.messages, action.payload) }
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState)
  const supabase = createClient()

  const createConversation = useCallback(async (language = 'en', tableNumber?: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      let {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const { error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError

        const refreshed = await supabase.auth.getUser()
        user = refreshed.data.user ?? null
      }

      const conversationInsert = createConversationInsert({
        userId: user?.id ?? null,
        restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID ?? null,
        language,
        tableNumber,
      })

      const { data: conversationRow, error } = await supabase
        .from('conversations')
        .insert(conversationInsert)
        .select()
        .single()

      if (error || !conversationRow) {
        throw error ?? new Error('Failed to create conversation')
      }

      const conversation = normalizeConversation(conversationRow)
      dispatch({ type: 'SET_CONVERSATION', payload: conversation })

      const welcomeInsert = createMessageInsert({
        conversationId: conversation.id,
        sender: 'assistant',
        content: getWelcomeMessage(language),
        metadata: { type: 'welcome' },
      })

      const { data: welcomeRow, error: welcomeError } = await supabase
        .from('messages')
        .insert(welcomeInsert)
        .select()
        .single()

      if (welcomeError || !welcomeRow) {
        throw welcomeError ?? new Error('Failed to create welcome message')
      }

      dispatch({ type: 'UPSERT_MESSAGE', payload: normalizeMessage(welcomeRow as MessageRow) })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message ?? 'Failed to start conversation' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [supabase])

  const loadConversation = useCallback(async (conversationId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    try {
      const { data: conversationRow, error: convError } = await supabase
        .from('conversations')
        .select()
        .eq('id', conversationId)
        .single()

      if (convError || !conversationRow) {
        throw convError ?? new Error('Conversation not found')
      }

      dispatch({ type: 'SET_CONVERSATION', payload: normalizeConversation(conversationRow) })

      const { data: messageRows, error: msgError } = await supabase
        .from('messages')
        .select()
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true })

      if (msgError) throw msgError

      const normalized = (messageRows ?? []).map((row) => normalizeMessage(row as MessageRow))
      dispatch({ type: 'SET_MESSAGES', payload: normalized })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message ?? 'Unable to load conversation' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [supabase])

  const sendMessage = useCallback(async (content: string, metadata?: Record<string, any>) => {
    if (!state.conversation) {
      dispatch({ type: 'SET_ERROR', payload: 'No active conversation' })
      return
    }

    const conversationId = state.conversation.id
    const clientMessageId = crypto.randomUUID()

    const toMessage = (raw: any): Message => {
      const fallbackId = raw.id ?? crypto.randomUUID()
      const row: MessageRow = {
        id: fallbackId,
        conversation_id: raw.conversation_id ?? conversationId,
        sender: raw.sender ?? raw.role ?? 'assistant',
        content: raw.content ?? '',
        metadata: (raw.metadata ?? {}) as MessageRow['metadata'],
        timestamp: raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
        created_at: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
      }

      return normalizeMessage(row)
    }

    try {
      const messageInsert = createMessageInsert({
        conversationId,
        sender: 'user',
        content,
        metadata,
        clientMessageId,
      })

      const now = new Date().toISOString()
      const pendingRow: MessageRow = {
        id: clientMessageId,
        conversation_id: conversationId,
        sender: 'user',
        content,
        metadata: (messageInsert.metadata ?? {}) as MessageRow['metadata'],
        timestamp: now,
        created_at: now,
      }

      const pendingMessage = normalizeMessage(pendingRow)
      pendingMessage.metadata.pending = true
      dispatch({ type: 'UPSERT_MESSAGE', payload: pendingMessage })

      const { data: insertedRow, error: insertError } = await supabase
        .from('messages')
        .insert(messageInsert)
        .select()
        .single()

      if (insertError || !insertedRow) {
        throw insertError ?? new Error('Failed to save message')
      }

      dispatch({ type: 'UPSERT_MESSAGE', payload: normalizeMessage(insertedRow as MessageRow) })

      dispatch({ type: 'SET_TYPING', payload: true })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          conversation_id: conversationId,
          metadata,
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      dispatch({ type: 'SET_TYPING', payload: false })

      if (data.assistant_reply) {
        dispatch({ type: 'UPSERT_MESSAGE', payload: toMessage(data.assistant_reply) })
      }
    } catch (error: any) {
      dispatch({ type: 'SET_TYPING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: error.message ?? 'Failed to send message' })
    }
  }, [state.conversation, supabase])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  // Subscribe to new messages (realtime)
  useEffect(() => {
    if (!state.conversation) return

    const channel = supabase
      .channel(`conversation:${state.conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${state.conversation.id}`,
        },
        (payload) => {
          const newRow = payload.new as MessageRow
          if (newRow.conversation_id !== state.conversation?.id) return

          dispatch({ type: 'UPSERT_MESSAGE', payload: normalizeMessage(newRow) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [state.conversation, supabase])

  return (
    <ChatContext.Provider
      value={{
        ...state,
        sendMessage,
        loadConversation,
        createConversation,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}

function getWelcomeMessage(language: string): string {
  const messages: Record<string, string> = {
    en: 'Hello! I\'m your AI waiter. I can help you with the menu, take your order, or answer any questions. How may I assist you today?',
    fr: 'Bonjour! Je suis votre serveur IA. Je peux vous aider avec le menu, prendre votre commande ou répondre à vos questions. Comment puis-je vous aider aujourd\'hui?',
    es: '¡Hola! Soy tu camarero de IA. Puedo ayudarte con el menú, tomar tu pedido o responder cualquier pregunta. ¿Cómo puedo asistirte hoy?',
    pt: 'Olá! Sou o seu garçom de IA. Posso ajudá-lo com o menu, anotar seu pedido ou responder a qualquer pergunta. Como posso ajudá-lo hoje?',
    de: 'Hallo! Ich bin Ihr KI-Kellner. Ich kann Ihnen bei der Speisekarte helfen, Ihre Bestellung aufnehmen oder Fragen beantworten. Wie kann ich Ihnen heute helfen?',
  }
  return messages[language] || messages.en
}
