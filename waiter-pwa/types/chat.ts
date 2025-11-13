export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  created_at: string
  metadata?: Record<string, any>
}

export interface Conversation {
  id: string
  user_id: string
  restaurant_id: string
  language: string
  table_number?: string
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
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
