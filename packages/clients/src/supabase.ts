import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

export interface SupabaseClientOptions {
  supabaseUrl?: string
  serviceRoleKey?: string
  anonKey?: string
  schema?: string
  globalHeaders?: Record<string, string>
}

export interface FavoritesRepository {
  listByDriverId(
    driverId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<FavoriteRow>>
}

export interface DriverRepository {
  findById(id: string): Promise<DriverRow | null>
}

export interface MatchRepository {
  listByDriverId(
    driverId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MatchRow>>
}

export interface DeeplinkRepository {
  create(payload: DeeplinkInsert): Promise<DeeplinkRow>
}

export interface BrokerRepository {
  getById(id: string): Promise<BrokerMessageRow | null>
}

export interface AdminRepository {
  listAudits(pagination: PaginationOptions): Promise<PaginatedResult<AdminAuditRow>>
}

export interface SupabaseRepositories {
  favorites: FavoritesRepository
  drivers: DriverRepository
  matches: MatchRepository
  deeplink: DeeplinkRepository
  broker: BrokerRepository
  admin: AdminRepository
}

export type SupabaseTypedClient = SupabaseClient

function resolveCredentials(options: SupabaseClientOptions) {
  const url = options.supabaseUrl ?? process.env.SUPABASE_URL
  const key =
    options.serviceRoleKey ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    options.anonKey ??
    process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase credentials are not configured')
  }

  return { url, key }
}

export function createSupabaseRepositories(options: SupabaseClientOptions = {}): SupabaseRepositories {
  const { url, key } = resolveCredentials(options)
  const client = createClient(url, key, {
    db: {
      schema: options.schema ?? 'public'
    },
    global: {
      headers: {
        'x-client-info': 'app-apis',
        ...options.globalHeaders
      }
    }
  })

  return {
    favorites: {
      async listByDriverId(driverId, pagination) {
        const { data, error, count } = await (client.from('favorites') as any)
          .select('*', { count: 'exact' })
          .eq('driver_id', driverId)
          .range(pagination.offset, pagination.offset + pagination.limit - 1)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        return {
          data: (data ?? []) as FavoriteRow[],
          count: count ?? 0
        }
      }
    },
    drivers: {
      async findById(id) {
        const { data, error } = await (client.from('drivers') as any)
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error && error.code !== 'PGRST116') {
          throw error
        }
        return (data as DriverRow | null) ?? null
      }
    },
    matches: {
      async listByDriverId(driverId, pagination) {
        const { data, error, count } = await (client.from('matches') as any)
          .select('*', { count: 'exact' })
          .eq('driver_id', driverId)
          .range(pagination.offset, pagination.offset + pagination.limit - 1)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        return {
          data: (data ?? []) as MatchRow[],
          count: count ?? 0
        }
      }
    },
    deeplink: {
      async create(payload) {
        const { data, error } = await (client.from('deeplinks') as any)
          .insert(payload)
          .select()
          .single()
        if (error) {
          throw error
        }
        return data as DeeplinkRow
      }
    },
    broker: {
      async getById(id) {
        const { data, error } = await (client.from('broker_messages') as any)
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error && error.code !== 'PGRST116') {
          throw error
        }
        return (data as BrokerMessageRow | null) ?? null
      }
    },
    admin: {
      async listAudits(pagination) {
        const { data, error, count } = await (client.from('admin_audits') as any)
          .select('*', { count: 'exact' })
          .range(pagination.offset, pagination.offset + pagination.limit - 1)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        return {
          data: (data ?? []) as AdminAuditRow[],
          count: count ?? 0
        }
      }
    }
  }
}
