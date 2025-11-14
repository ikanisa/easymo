import type { Database } from './database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ConversationRow = Database['public']['Tables']['conversations']['Row']

export type MessageSender = MessageRow['sender']

export type Message = Omit<MessageRow, 'metadata' | 'timestamp'> & {
  metadata: Record<string, any>
  timestamp: string
}

export type Conversation = Omit<ConversationRow, 'metadata'> & {
  metadata: Record<string, any>
}

export interface ChatState {
  conversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  error: string | null
  isTyping: boolean
}

export interface QuickAction {
  id: string
  label: string
  icon?: string
  action: string
}

export interface SendMessageRequest {
  content: string
  conversation_id?: string
  metadata?: Record<string, any>
}

export interface SendMessageResponse {
  message: Message
  conversation: Conversation
  assistant_reply?: Message
}
