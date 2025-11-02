export interface FavoriteRow {
  id: string
  driver_id: string
  rider_id: string
  notes: string | null
  created_at: string
}

export interface DriverRow {
  id: string
  name: string
  rating: number
  active: boolean
  preferred_city: string | null
  updated_at: string
}

export interface MatchRow {
  id: string
  driver_id: string
  rider_id: string
  status: 'matched' | 'cancelled' | 'completed'
  created_at: string
}

export interface DeeplinkRow {
  id: string
  url: string
  expires_at: string
  created_at: string
  metadata: Record<string, unknown>
}

export interface DeeplinkInsert {
  id?: string
  url: string
  expires_at: string
  metadata: Record<string, unknown>
}

export interface BrokerMessageRow {
  id: string
  topic: string
  payload: Record<string, unknown>
  delivered_at: string | null
  created_at: string
}

export interface AdminAuditRow {
  id: string
  actor_id: string
  action: string
  created_at: string
  target: string
}

export interface PaginationOptions {
  limit: number
  offset: number
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
}

export interface Database {
  public: {
    Tables: {
      favorites: Table<FavoriteRow>
      drivers: Table<DriverRow>
      matches: Table<MatchRow>
      deeplinks: Table<DeeplinkRow, DeeplinkInsert>
      broker_messages: Table<BrokerMessageRow>
      admin_audits: Table<AdminAuditRow>
    }
  }
}
