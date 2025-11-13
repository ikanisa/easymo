'use client'

import { createContext, useContext, useCallback, useReducer, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Message, Conversation, ChatState, SendMessageRequest } from '@/types/chat'

interface ChatContextType extends ChatState {
  sendMessage: (content: string, metadata?: Record<string, any>) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  createConversation: (language?: string, tableNumber?: string) => Promise<void>
  clearError: () => void
}

type ChatAction =
  | { type: 'SET_CONVERSATION'; payload: Conversation }
  | { type: 'ADD_MESSAGE'; payload: Message }
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
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] }
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
    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // Get or create anonymous user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data: { user: anonUser }, error: authError } = await supabase.auth.signInAnonymously()
        if (authError || !anonUser) throw new Error('Failed to create session')
      }

      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user?.id || '',
          restaurant_id: process.env.NEXT_PUBLIC_RESTAURANT_ID!,
          language,
          table_number: tableNumber,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      dispatch({ type: 'SET_CONVERSATION', payload: conversation })

      // Create welcome message
      const welcomeMessage = {
        conversation_id: conversation.id,
        role: 'assistant' as const,
        content: getWelcomeMessage(language),
      }

      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert(welcomeMessage)
        .select()
        .single()

      if (msgError) throw msgError
      dispatch({ type: 'ADD_MESSAGE', payload: message })
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }, [supabase])

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })

      // Load conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select()
        .eq('id', conversationId)
        .single()

      if (convError) throw convError
      dispatch({ type: 'SET_CONVERSATION', payload: conversation })

      // Load messages
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select()
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (msgError) throw msgError
      dispatch({ type: 'SET_MESSAGES', payload: messages || [] })
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
    }
  }, [supabase])

  const sendMessage = useCallback(async (content: string, metadata?: Record<string, any>) => {
    if (!state.conversation) {
      dispatch({ type: 'SET_ERROR', payload: 'No active conversation' })
      return
    }

    try {
      // Add user message optimistically
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: state.conversation.id,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        metadata,
      }
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage })

      // Save to database
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: state.conversation.id,
          role: 'user',
          content,
          metadata,
        })

      if (insertError) throw insertError

      // Show typing indicator
      dispatch({ type: 'SET_TYPING', payload: true })

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          conversation_id: state.conversation.id,
          metadata,
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      
      dispatch({ type: 'SET_TYPING', payload: false })

      if (data.assistant_reply) {
        dispatch({ type: 'ADD_MESSAGE', payload: data.assistant_reply })
      }
    } catch (error: any) {
      dispatch({ type: 'SET_TYPING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: error.message })
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
          const newMessage = payload.new as Message
          // Only add if not already in state (avoid duplicates)
          if (!state.messages.find(m => m.id === newMessage.id)) {
            dispatch({ type: 'ADD_MESSAGE', payload: newMessage })
          }
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
