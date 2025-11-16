import type { Database, Json } from '../types/database'
import type { Conversation, Message } from '../types/chat'

export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type ConversationRow = Database['public']['Tables']['conversations']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']

interface ConversationInput {
  userId?: string | null
  restaurantId?: string | null
  language?: string
  tableNumber?: string | null
  metadata?: Record<string, unknown>
}

interface MessageInput {
  conversationId: string
  sender: MessageRow['sender']
  content: string
  metadata?: Record<string, unknown>
  clientMessageId?: string
}

const DEFAULT_LANGUAGE = 'en'

export function createConversationInsert({
  userId,
  restaurantId,
  language,
  tableNumber,
  metadata,
}: ConversationInput): ConversationInsert {
  const payload: ConversationInsert = {}

  if (userId) {
    payload.user_id = userId
  }

  if (restaurantId) {
    payload.restaurant_id = restaurantId
  }

  if (tableNumber) {
    payload.table_number = tableNumber
  }

  if (language && language !== DEFAULT_LANGUAGE) {
    payload.language = language
  }

  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata as Json
  }

  return payload
}

export function createMessageInsert({
  conversationId,
  sender,
  content,
  metadata,
  clientMessageId,
}: MessageInput): MessageInsert {
  const enrichedMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
  }

  if (clientMessageId) {
    enrichedMetadata.client_message_id = clientMessageId
  }

  const insert: MessageInsert = {
    conversation_id: conversationId,
    sender,
    content,
  }

  if (Object.keys(enrichedMetadata).length > 0) {
    insert.metadata = enrichedMetadata as Json
  }

  return insert
}

function jsonToRecord(value: Json | undefined | null): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, any>
}

export function normalizeConversation(row: ConversationRow): Conversation {
  return {
    ...row,
    metadata: jsonToRecord(row.metadata),
  }
}

export function normalizeMessage(row: MessageRow): Message {
  const timestamp = row.timestamp ?? row.created_at

  return {
    ...row,
    timestamp,
    metadata: jsonToRecord(row.metadata),
  }
}

export function getClientMessageId(message: Message): string | undefined {
  const value = message.metadata?.client_message_id
  return typeof value === 'string' ? value : undefined
}

export function mergeMessages(existing: Message[], incoming: Message): Message[] {
  const clientMessageId = getClientMessageId(incoming)
  const index = existing.findIndex((msg) => {
    if (msg.id && incoming.id && msg.id === incoming.id) {
      return true
    }

    if (clientMessageId) {
      return getClientMessageId(msg) === clientMessageId
    }

    return false
  })

  if (index === -1) {
    return [...existing, incoming]
  }

  const next = [...existing]
  const mergedMetadata = {
    ...next[index].metadata,
    ...incoming.metadata,
  }

  delete mergedMetadata.pending

  next[index] = {
    ...next[index],
    ...incoming,
    metadata: mergedMetadata,
  }

  return next
}
