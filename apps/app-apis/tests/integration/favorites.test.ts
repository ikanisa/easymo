import { describe, expect, beforeEach, afterEach, it } from 'vitest'
import { GET as favoritesHandler } from '../../app/api/favorites/route'
import { setSupabaseRepositoriesForTests } from '../../lib/supabase'
import {
  createSupabaseTestRepositories,
  type FavoriteRow
} from '@easymo/clients'
import { resetLogger, setLogger } from '../../lib/logger'
import type { SuccessResponse } from '../../lib/response'
import type { FavoritesResponse } from '../../domain/favorites'
import type { StructuredError } from '../../lib/errors'

const driverId = '11111111-1111-1111-1111-111111111111'

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  })
}

describe('favorites route', () => {
  beforeEach(() => {
    const favorites: FavoriteRow[] = Array.from({ length: 40 }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      driver_id: driverId,
      rider_id: `22222222-2222-2222-2222-${String(index).padStart(12, '0')}`,
      notes: index % 2 === 0 ? `note-${index}` : null,
      created_at: new Date(Date.now() - index * 1000).toISOString()
    }))
    setSupabaseRepositoriesForTests(
      createSupabaseTestRepositories({
        favorites
      })
    )
    resetLogger()
  })

  afterEach(() => {
    resetLogger()
  })

  it('returns validation errors with structured payload when query is invalid', async () => {
    const response = await favoritesHandler(
      buildRequest('https://example.com/api/favorites?page=1')
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: StructuredError }
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('BAD_REQUEST')
    const issues = (
      body.error.details as { issues?: Array<{ path?: string[] }> } | undefined
    )?.issues
    expect(issues?.[0]?.path).toContain('driverId')
    expect(body.error.requestId).toBeTruthy()
  })

  it('applies pagination defaults when not provided', async () => {
    const response = await favoritesHandler(
      buildRequest(`https://example.com/api/favorites?driverId=${driverId}`)
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as SuccessResponse<FavoritesResponse>
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(25)
    expect(body.data.items).toHaveLength(25)
    expect(body.data.total).toBe(40)
  })

  it('logs the provided request id for observability', async () => {
    const entries: unknown[] = []
    setLogger((entry) => {
      entries.push(entry)
    })

    const customRequestId = 'req-1234'

    const response = await favoritesHandler(
      buildRequest(`https://example.com/api/favorites?driverId=${driverId}`, {
        headers: {
          'x-request-id': customRequestId
        }
      })
    )

    expect(response.status).toBe(200)
    expect(entries).toContainEqual(
      expect.objectContaining({ requestId: customRequestId, level: 'info' })
    )
  })
})
