import { describe, expect, it } from 'vitest'

import {
  createConversationInsert,
  createMessageInsert,
  mergeMessages,
  normalizeMessage,
  type MessageRow,
} from '../../waiter-pwa/contexts/chat-helpers'
import type { Message } from '../../waiter-pwa/types/chat'

const BASE_CONVERSATION_ID = '00000000-0000-4000-8000-000000000001'

function buildMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000099',
    conversation_id: overrides.conversation_id ?? BASE_CONVERSATION_ID,
    sender: overrides.sender ?? 'user',
    content: overrides.content ?? 'hello world',
    metadata: overrides.metadata ?? {},
    timestamp: overrides.timestamp ?? '2024-01-01T00:00:00.000Z',
    created_at: overrides.created_at ?? '2024-01-01T00:00:00.000Z',
  }
}

describe('waiter chat supabase integration helpers', () => {
  it('builds conversation payload with schema-aligned fields', () => {
    const payload = createConversationInsert({
      userId: '00000000-0000-4000-8000-000000000002',
      restaurantId: 'venue-123',
      language: 'fr',
      tableNumber: 'A1',
      metadata: { source: 'qr' },
    })

    expect(payload).toMatchObject({
      user_id: '00000000-0000-4000-8000-000000000002',
      restaurant_id: 'venue-123',
      table_number: 'A1',
      language: 'fr',
      metadata: { source: 'qr' },
    })
    expect(payload).not.toHaveProperty('status')
  })

  it('omits default language to rely on database defaults', () => {
    const payload = createConversationInsert({ language: 'en' })
    expect(payload).not.toHaveProperty('language')
  })

  it('creates message insert payload with sender column and client id metadata', () => {
    const payload = createMessageInsert({
      conversationId: BASE_CONVERSATION_ID,
      sender: 'user',
      content: 'hi there',
      metadata: { quick_action: 'menu' },
      clientMessageId: 'client-123',
    })

    expect(payload).toMatchObject({
      conversation_id: BASE_CONVERSATION_ID,
      sender: 'user',
      content: 'hi there',
    })
    expect(payload.metadata).toEqual({ quick_action: 'menu', client_message_id: 'client-123' })
  })

  it('reconciles realtime messages against pending placeholder entries', () => {
    const pending = normalizeMessage(
      buildMessageRow({
        id: 'temp-1',
        metadata: { client_message_id: 'client-123', pending: true },
        timestamp: '2024-01-01T00:00:01.000Z',
      }),
    )

    const realtime = normalizeMessage(
      buildMessageRow({
        id: 'server-1',
        metadata: { client_message_id: 'client-123' },
        timestamp: '2024-01-01T00:00:02.000Z',
      }),
    )

    const merged = mergeMessages([pending], realtime)
    expect(merged).toHaveLength(1)
    const [message] = merged as [Message]
    expect(message.id).toBe('server-1')
    expect(message.metadata.pending).toBeUndefined()
    expect(message.metadata.client_message_id).toBe('client-123')
  })
})
