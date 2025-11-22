import { randomUUID } from 'node:crypto'

import type { SupabaseRepositories } from './supabase'
import type {
  AdminAuditRow,
  BrokerMessageRow,
  DeeplinkInsert,
  DeeplinkRow,
  DriverRow,
  FavoriteRow,
  MatchRow,
  PaginatedResult,
  PaginationOptions
} from './types'

export interface SupabaseTestData {
  favorites?: FavoriteRow[]
  drivers?: DriverRow[]
  matches?: MatchRow[]
  deeplinks?: DeeplinkRow[]
  broker_messages?: BrokerMessageRow[]
  admin_audits?: AdminAuditRow[]
}

function paginate<T>(rows: T[] = [], { limit, offset }: PaginationOptions): PaginatedResult<T> {
  const data = rows.slice(offset, offset + limit)
  return { data, count: rows.length }
}

export function createSupabaseTestRepositories(data: SupabaseTestData = {}): SupabaseRepositories {
  const favorites = data.favorites ?? []
  const drivers = data.drivers ?? []
  const matches = data.matches ?? []
  const deeplinks = data.deeplinks ?? []
  const brokerMessages = data.broker_messages ?? []
  const adminAudits = data.admin_audits ?? []

  return {
    favorites: {
      async listByDriverId(driverId, pagination) {
        return paginate(
          favorites.filter((row) => row.driver_id === driverId),
          pagination
        )
      }
    },
    drivers: {
      async findById(id) {
        return drivers.find((driver) => driver.id === id) ?? null
      }
    },
    matches: {
      async listByDriverId(driverId, pagination) {
        return paginate(
          matches.filter((row) => row.driver_id === driverId),
          pagination
        )
      }
    },
    deeplink: {
      async create(payload: DeeplinkInsert) {
        const row: DeeplinkRow = {
          id: payload.id ?? randomUUID(),
          url: payload.url,
          expires_at: payload.expires_at,
          metadata: payload.metadata,
          created_at: new Date().toISOString()
        }
        deeplinks.push(row)
        return row
      }
    },
    broker: {
      async getById(id) {
        return brokerMessages.find((row) => row.id === id) ?? null
      }
    },
    admin: {
      async listAudits(pagination) {
        return paginate(adminAudits, pagination)
      }
    }
  }
}
