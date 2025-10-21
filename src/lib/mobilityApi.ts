import { getMobilityUserId, getMobilityUserRoles } from './env';

type RequestInitWithBody = RequestInit & { body?: unknown };

async function fetchJson<T>(path: string, options: RequestInitWithBody = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-user-id', getMobilityUserId());
  headers.set('x-user-roles', getMobilityUserRoles());

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : options.body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export type Favorite = {
  id: string;
  kind: string;
  label: string;
  address: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  coordinates: { lat: number; lng: number } | null;
};

export type RecurringTrip = {
  id: string;
  origin_favorite_id: string;
  dest_favorite_id: string;
  days_of_week: number[];
  time_local: string;
  timezone: string;
  radius_km: number;
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverParking = {
  id: string;
  label: string;
  active: boolean;
  coordinates: { lat: number; lng: number } | null;
  updated_at: string;
};

export type DriverAvailability = {
  id: string;
  parking_id: string | null;
  days_of_week: number[];
  start_time_local: string;
  end_time_local: string;
  timezone: string;
  active: boolean;
  updated_at: string;
};

export type MatchCandidate = {
  id: string;
  user_id: string;
  kind: string;
  pickup_distance_km: number;
  dropoff_distance_km: number | null;
  created_at: string | null;
  source?: 'live' | 'parking';
  availability_fits?: boolean;
  rank_score?: number | null;
};

export const MobilityAPI = {
  listFavorites: async (): Promise<Favorite[]> => {
    const payload = await fetchJson<{ favorites: Favorite[] }>('/api/favorites/list');
    return payload.favorites ?? [];
  },
  createFavorite: (body: {
    kind: 'home' | 'work' | 'school' | 'other';
    label: string;
    address?: string;
    lat: number;
    lng: number;
    is_default?: boolean;
  }): Promise<{ favorite: Favorite }> => fetchJson('/api/favorites/create', { method: 'POST', body }),
  updateFavorite: (body: {
    id: string;
    label?: string;
    address?: string | null;
    lat?: number;
    lng?: number;
    is_default?: boolean;
  }): Promise<{ favorite: Favorite | null }> => fetchJson('/api/favorites/update', { method: 'POST', body }),
  deleteFavorite: (id: string): Promise<{ ok: boolean }> => fetchJson('/api/favorites/delete', { method: 'POST', body: { id } }),

  listRecurringTrips: async (): Promise<RecurringTrip[]> => {
    const payload = await fetchJson<{ trips: RecurringTrip[] }>('/api/recurring-trips/list');
    return payload.trips ?? [];
  },
  createRecurringTrip: (body: {
    origin_favorite_id: string;
    dest_favorite_id: string;
    days_of_week: number[];
    time_local: string;
    timezone?: string;
    radius_km?: number;
  }): Promise<{ trip: RecurringTrip }> => fetchJson('/api/recurring-trips/create', { method: 'POST', body }),
  updateRecurringTrip: (body: {
    id: string;
    origin_favorite_id?: string;
    dest_favorite_id?: string;
    days_of_week?: number[];
    time_local?: string;
    timezone?: string;
    radius_km?: number;
    active?: boolean;
  }): Promise<{ trip: RecurringTrip | null }> => fetchJson('/api/recurring-trips/update', { method: 'POST', body }),
  deleteRecurringTrip: (id: string): Promise<{ ok: boolean }> =>
    fetchJson('/api/recurring-trips/delete', { method: 'POST', body: { id } }),

  listDriverParking: async (): Promise<DriverParking[]> => {
    const payload = await fetchJson<{ parkings: DriverParking[] }>('/api/driver/parking/list');
    return payload.parkings ?? [];
  },
  createDriverParking: (body: {
    label: string;
    lat: number;
    lng: number;
    active?: boolean;
  }): Promise<{ parking: DriverParking }> => fetchJson('/api/driver/parking/create', { method: 'POST', body }),
  updateDriverParking: (body: {
    id: string;
    label?: string;
    lat?: number;
    lng?: number;
    active?: boolean;
  }): Promise<{ parking: DriverParking | null }> => fetchJson('/api/driver/parking/update', { method: 'POST', body }),

  listDriverAvailability: async (): Promise<DriverAvailability[]> => {
    const payload = await fetchJson<{ availability: DriverAvailability[] }>('/api/driver/availability/list');
    return payload.availability ?? [];
  },
  createDriverAvailability: (body: {
    parking_id?: string | null;
    days_of_week: number[];
    start_time_local: string;
    end_time_local: string;
    timezone?: string;
    active?: boolean;
  }): Promise<{ availability: DriverAvailability }> => fetchJson('/api/driver/availability/create', { method: 'POST', body }),
  updateDriverAvailability: (body: {
    id: string;
    parking_id?: string | null;
    days_of_week?: number[];
    start_time_local?: string;
    end_time_local?: string;
    timezone?: string;
    active?: boolean;
  }): Promise<{ availability: DriverAvailability | null }> =>
    fetchJson('/api/driver/availability/update', { method: 'POST', body }),
  deleteDriverAvailability: (id: string): Promise<{ ok: boolean }> =>
    fetchJson('/api/driver/availability/delete', { method: 'POST', body: { id } }),

  searchMatches: async (body: {
    actor_kind: 'driver' | 'passenger';
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number } | null;
    origin_favorite_id?: string;
    dest_favorite_id?: string;
    radius_km?: number;
  }): Promise<{ candidates: MatchCandidate[] }> => fetchJson('/api/match/search', { method: 'POST', body }),
};
