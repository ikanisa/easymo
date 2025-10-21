/**
 * Production API Client for Admin Panel
 * Calls Supabase Edge Function endpoints with admin authentication.
 */

import { API_BASE, ADMIN_HEADERS } from './api-constants';
import type {
  Settings,
  AdminStats,
  User,
  Trip,
  Subscription,
  DriverPresence,
  Profile,
  VehicleType,
  AgentChatResponse,
  AgentChatRequest,
} from './types';

import type { RetrievalSearchRequest, RetrievalSearchResponse } from './types';

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: ADMIN_HEADERS(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: ADMIN_HEADERS(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

const randomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const toAgentChatResponse = (payload: unknown): AgentChatResponse => {
  if (!payload || typeof payload !== 'object') {
    return {
      session: { id: '', agent_kind: 'broker', status: 'open' },
      messages: [],
      suggestions: [],
    };
  }

  const raw = payload as {
    session?: Partial<AgentChatResponse['session']>;
    messages?: Array<Partial<AgentChatResponse['messages'][number]>>;
    suggestions?: string[];
  };

  const session = raw.session ?? {};
  const messages = (raw.messages ?? []).map((msg) => ({
    id: msg.id ?? randomId(),
    role: msg.role === 'agent' || msg.role === 'system' ? msg.role : 'user',
    text: typeof msg.text === 'string'
      ? msg.text
      : typeof (msg as any)?.payload?.text === 'string'
        ? (msg as any).payload.text
        : '',
    created_at: msg.created_at ?? new Date().toISOString(),
    payload: (msg as any)?.payload ?? undefined,
  }));

  return {
    session: {
      id: session.id ?? randomId(),
      agent_kind: session.agent_kind ?? 'broker',
      status: session.status ?? 'open',
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    messages,
    suggestions: raw.suggestions ?? [],
  };
};

const toRetrievalSearchResponse = (payload: unknown): RetrievalSearchResponse => {
  if (!payload || typeof payload !== 'object') {
    return { status: 'error', results: [], message: 'invalid_response' };
  }

  const raw = payload as Record<string, unknown>;
  const statusValue = raw.status === 'error' ? 'error' : 'ok';

  const queryPart = raw.query && typeof raw.query === 'object' && !Array.isArray(raw.query)
    ? {
        original: typeof (raw.query as Record<string, unknown>).original === 'string'
          ? (raw.query as Record<string, unknown>).original as string
          : undefined,
        rewritten: typeof (raw.query as Record<string, unknown>).rewritten === 'string'
          ? (raw.query as Record<string, unknown>).rewritten as string
          : undefined,
        vector_store_id: typeof (raw.query as Record<string, unknown>).vector_store_id === 'string'
          ? (raw.query as Record<string, unknown>).vector_store_id as string
          : undefined,
      }
    : undefined;

  const resultsRaw = Array.isArray((raw as Record<string, unknown>).results)
    ? (raw as Record<string, unknown>).results as unknown[]
    : [];

  const results = resultsRaw.map((item) => {
    if (!item || typeof item !== 'object') {
      return {} as RetrievalSearchResult;
    }

    const record = item as Record<string, unknown>;

    const contentRaw = Array.isArray(record.content)
      ? record.content as unknown[]
      : [];

    const content = contentRaw
      .filter((chunk): chunk is Record<string, unknown> => Boolean(chunk) && typeof chunk === 'object')
      .map((chunk) => {
        const normalized: RetrievalSearchChunk = {};
        if (typeof chunk.type === 'string') {
          normalized.type = chunk.type;
        }
        if (typeof chunk.text === 'string') {
          normalized.text = chunk.text;
        }
        for (const [key, value] of Object.entries(chunk)) {
          if (key === 'type' || key === 'text') continue;
          normalized[key] = value;
        }
        return normalized;
      });

    const normalizedResult: RetrievalSearchResult = {
      file_id: typeof record.file_id === 'string' ? record.file_id : undefined,
      filename: typeof record.filename === 'string' ? record.filename : undefined,
      score: typeof record.score === 'number' ? record.score : undefined,
      attributes: record.attributes && typeof record.attributes === 'object' && !Array.isArray(record.attributes)
        ? record.attributes as Record<string, unknown>
        : undefined,
    };

    if (content.length > 0) {
      normalizedResult.content = content;
    }

    return normalizedResult;
  });

  const usage = raw.usage && typeof raw.usage === 'object' && !Array.isArray(raw.usage)
    ? raw.usage as Record<string, unknown>
    : undefined;

  const meta = raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
    ? raw.meta as Record<string, unknown>
    : undefined;

  return {
    status: statusValue,
    query: queryPart,
    results,
    usage,
    meta,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
  };
};

export type HealthCheckResult = {
  status: 'ok' | 'error';
  timestamp: string;
  round_trip_ms: number;
  message?: string;
  fallback?: {
    status: 'ok' | 'error';
    round_trip_ms: number;
    message?: string;
  };
};

export const AdminAPI = {
  // Settings / Flags
  getSettings: async (): Promise<Settings & { pro_enabled?: boolean }> => {
    const payload = await apiGet<unknown>('/admin-settings');
    if (payload && typeof payload === 'object' && 'config' in payload) {
      const { config } = payload as { config?: Settings & { pro_enabled?: boolean } };
      if (config) return config;
    }
    return payload as Settings & { pro_enabled?: boolean };
  },

  saveSettings: async (patch: Partial<Settings & { pro_enabled?: boolean }>): Promise<Settings & { pro_enabled?: boolean }> => {
    const payload = await apiPost<unknown>('/admin-settings', patch);
    if (payload && typeof payload === 'object' && 'config' in payload) {
      const { config } = payload as { config?: Settings & { pro_enabled?: boolean } };
      if (config) return config;
    }
    return AdminAPI.getSettings();
  },

  // Operations metrics
  getStats: async (): Promise<AdminStats> => {
    const payload = await apiGet<unknown>('/admin-stats');
    if (payload && typeof payload === 'object') {
      const stats = payload as Partial<AdminStats> & {
        drivers_online?: number;
        open_passenger_trips?: number;
        open_trips?: number;
        active_subscribers?: number;
        active_subscriptions?: number;
      };
      return {
        drivers_online: stats.drivers_online ?? 0,
        open_trips: stats.open_trips ?? stats.open_passenger_trips ?? 0,
        active_subscriptions: stats.active_subscriptions ?? stats.active_subscribers ?? 0,
        total_users: stats.total_users,
        active_subscribers: stats.active_subscribers,
        pending_subscriptions: stats.pending_subscriptions,
        total_trips: stats.total_trips,
        open_passenger_trips: stats.open_passenger_trips,
        completed_trips_today: stats.completed_trips_today,
        revenue_this_month: stats.revenue_this_month,
      };
    }
    return {
      drivers_online: 0,
      open_trips: 0,
      active_subscriptions: 0,
    };
  },

  // Data views
  getUsers: async (): Promise<User[]> => {
    const payload = await apiGet<unknown>('/admin-users');
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && typeof payload === 'object' && 'users' in payload) {
      const { users } = payload as { users?: User[] };
      return users ?? [];
    }
    return [];
  },

  listTrips: async (): Promise<Trip[]> => {
    const payload = await apiGet<unknown>('/admin-trips?action=list');
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && typeof payload === 'object' && 'trips' in payload) {
      const { trips } = payload as { trips?: Trip[] };
      return trips ?? [];
    }
    return [];
  },

  closeTrip: (id: number): Promise<void> => apiPost('/admin-trips?action=close', { id }),

  // Monetization
  listSubs: async (): Promise<Subscription[]> => {
    const payload = await apiGet<unknown>('/admin-subscriptions?action=list');
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && typeof payload === 'object' && 'subscriptions' in payload) {
      const { subscriptions } = payload as { subscriptions?: Subscription[] };
      return subscriptions ?? [];
    }
    return [];
  },

  approveSub: (id: number, txn_id?: string): Promise<void> =>
    apiPost('/admin-subscriptions?action=approve', { id, txn_id }),

  rejectSub: (id: number, reason?: string): Promise<void> =>
    apiPost('/admin-subscriptions?action=reject', { id, reason }),

  simulatorDrivers: async (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    radius_km?: number;
    max?: number;
  }): Promise<DriverPresence[]> => {
    const searchParams = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      vehicle_type: params.vehicle_type,
    });
    if (params.radius_km !== undefined) {
      searchParams.set('radius_km', String(params.radius_km));
    }
    if (params.max !== undefined) {
      searchParams.set('max', String(params.max));
    }

    const payload = await apiGet<unknown>(`/simulator?action=drivers&${searchParams.toString()}`);
    if (Array.isArray(payload)) {
      return payload as DriverPresence[];
    }
    if (payload && typeof payload === 'object' && 'drivers' in payload) {
      const { drivers } = payload as { drivers?: DriverPresence[] };
      return drivers ?? [];
    }
    return [];
  },

  simulatorPassengers: async (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    driver_ref_code?: string;
    force_access?: boolean;
    radius_km?: number;
    max?: number;
  }): Promise<{ access: boolean; trips?: Trip[]; reason?: string; credits_left?: number; used_credit?: boolean }> => {
    const searchParams = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      vehicle_type: params.vehicle_type,
    });
    if (params.driver_ref_code) {
      searchParams.set('driver_ref_code', params.driver_ref_code);
    }
    if (params.force_access !== undefined) {
      searchParams.set('force_access', params.force_access ? '1' : '0');
    }
    if (params.radius_km !== undefined) {
      searchParams.set('radius_km', String(params.radius_km));
    }
    if (params.max !== undefined) {
      searchParams.set('max', String(params.max));
    }

    const payload = await apiGet<unknown>(`/simulator?action=passengers&${searchParams.toString()}`);
    if (payload && typeof payload === 'object' && 'access' in payload) {
      const { access, trips, reason, credits_left, used_credit } = payload as {
        access: boolean;
        trips?: Trip[];
        reason?: string;
        credits_left?: number;
        used_credit?: boolean;
      };
      return { access, trips, reason, credits_left, used_credit };
    }

    return { access: false, reason: 'unexpected_response' };
  },

  simulatorProfile: async (refCode: string): Promise<Profile | null> => {
    const searchParams = new URLSearchParams({ ref: refCode });
    const payload = await apiGet<unknown>(`/simulator?action=profile&${searchParams.toString()}`);
    if (payload && typeof payload === 'object') {
      if ('profile' in payload) {
        const { profile } = payload as { profile?: Profile | null };
        return profile ?? null;
      }
      return payload as Profile;
    }
    return null;
  },

  simulatorSchedulePassenger: async (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    ref_code: string;
  }): Promise<Trip> => {
    const payload = await apiPost<{ trip: Trip & { lat?: number; lng?: number } }>(
      '/simulator?action=schedule_passenger',
      params,
    );
    const trip = payload.trip;
    return {
      id: trip.id,
      creator_user_id: trip.creator_user_id,
      role: trip.role,
      vehicle_type: trip.vehicle_type,
      status: trip.status,
      created_at: trip.created_at,
      ref_code: trip.ref_code,
      whatsapp_e164: trip.whatsapp_e164,
      lat: trip.lat ?? params.lat,
      lng: trip.lng ?? params.lng,
    };
  },

  simulatorScheduleDriver: async (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    ref_code: string;
    force_access?: boolean;
  }): Promise<
    | { access: false; reason?: string; credits_left?: number; used_credit?: boolean }
    | { access: true; trip: Trip; credits_left?: number | null; used_credit?: boolean }
  > => {
    const payload = await apiPost<
      | { access: false; reason?: string; credits_left?: number; used_credit?: boolean }
      | { access: true; trip: Trip & { lat?: number; lng?: number }; credits_left?: number | null; used_credit?: boolean }
    >('/simulator?action=schedule_driver', params);

    if ('access' in payload && !payload.access) {
      return payload;
    }

    const tripPayload = payload as {
      access: true;
      trip: Trip & { lat?: number; lng?: number };
      credits_left?: number | null;
      used_credit?: boolean;
    };
    return {
      access: true,
      trip: {
        id: tripPayload.trip.id,
        creator_user_id: tripPayload.trip.creator_user_id,
        role: tripPayload.trip.role,
        vehicle_type: tripPayload.trip.vehicle_type,
        status: tripPayload.trip.status,
        created_at: tripPayload.trip.created_at,
        ref_code: tripPayload.trip.ref_code,
        whatsapp_e164: tripPayload.trip.whatsapp_e164,
        lat: tripPayload.trip.lat ?? params.lat,
        lng: tripPayload.trip.lng ?? params.lng,
      },
      credits_left: tripPayload.credits_left,
      used_credit: tripPayload.used_credit,
    };
  },

  agentChatSend: async (request: AgentChatRequest): Promise<AgentChatResponse> => {
    const payload = await apiPost<unknown>('/agent-chat', {
      agent_kind: request.agentKind,
      message: request.message,
      session_id: request.sessionId,
      profile_ref: request.profileRef,
    });
    return toAgentChatResponse(payload);
  },

  agentChatHistory: async (sessionId: string): Promise<AgentChatResponse | null> => {
    const response = await fetch(`${API_BASE}/agent-chat?session_id=${encodeURIComponent(sessionId)}`, {
      headers: ADMIN_HEADERS(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return toAgentChatResponse(payload);
  },

  // Retrieval search
  searchRetrieval: async (request: RetrievalSearchRequest): Promise<RetrievalSearchResponse> => {
    const payload = await apiPost<unknown>('/retrieval-search', request);
    return toRetrievalSearchResponse(payload);
  },

  // Storage ingestion
  mediaFetch: (media_id: string, subscription_id: number): Promise<{ signed_url: string }> =>
    apiPost('/media-fetch', { media_id, subscription_id }),

  // Health check
  healthCheck: async (): Promise<HealthCheckResult> => {
    const timestamp = new Date().toISOString();
    const start = Date.now();

    try {
      await apiGet('/admin-stats');
      return {
        status: 'ok',
        timestamp,
        round_trip_ms: Date.now() - start,
      };
    } catch (primaryError) {
      const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackStart = Date.now();

      try {
        const fallbackResponse = await fetch('/api/integrations/status');
        const fallbackRoundTrip = Date.now() - fallbackStart;

        if (fallbackResponse.ok) {
          return {
            status: 'error',
            timestamp,
            round_trip_ms: Date.now() - start,
            message,
            fallback: {
              status: 'ok',
              round_trip_ms: fallbackRoundTrip,
            },
          };
        }

        const fallbackBody = await fallbackResponse.text().catch(() => '');
        return {
          status: 'error',
          timestamp,
          round_trip_ms: Date.now() - start,
          message,
          fallback: {
            status: 'error',
            round_trip_ms: fallbackRoundTrip,
            message: fallbackBody
              ? `Fallback responded with ${fallbackResponse.status}: ${fallbackBody}`
              : `Fallback responded with ${fallbackResponse.status}`,
          },
        };
      } catch (fallbackError) {
        return {
          status: 'error',
          timestamp,
          round_trip_ms: Date.now() - start,
          message,
          fallback: {
            status: 'error',
            round_trip_ms: Date.now() - fallbackStart,
            message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          },
        };
      }
    }
  },
};

// Error handling utilities
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function isUnauthorized(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('401') || error.message.includes('403');
  }
  return false;
}
