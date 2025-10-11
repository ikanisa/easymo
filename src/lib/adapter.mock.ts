/**
 * ULTRA-MINIMAL WhatsApp Mobility - Phase 1 Mock Adapter
 * In-memory + localStorage implementation for frontend-only testing
 */

import type { 
  Profile, 
  DriverPresence, 
  Trip, 
  Subscription, 
  Settings, 
  AdminStats, 
  User,
  VehicleType 
} from './types';

const STORAGE_KEY = 'mobility_mock_data';

interface MockData {
  profiles: Profile[];
  drivers: DriverPresence[];
  trips: Trip[];
  subscriptions: Subscription[];
  settings: Settings;
  users: User[]; // compatibility
}

const DEFAULT_SETTINGS: Settings = {
  subscription_price: 5000,
  search_radius_km: 5.0,
  max_results: 10,
  momo_payee_number: '0788123456',
  support_phone_e164: '+250788123456',
  admin_whatsapp_numbers: '+250788123456,+250788654321'
};

const SEED_DATA: MockData = {
  profiles: [
    {
      user_id: 'user-001',
      whatsapp_e164: '+250788111111',
      ref_code: '123456',
      credits_balance: 0,
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      user_id: 'user-002', 
      whatsapp_e164: '+250788222222',
      ref_code: '234567',
      credits_balance: 10,
      created_at: new Date(Date.now() - 172800000).toISOString()
    },
    {
      user_id: 'user-003',
      whatsapp_e164: '+250788333333', 
      ref_code: '345678',
      credits_balance: 0,
      created_at: new Date(Date.now() - 259200000).toISOString()
    }
  ],
  drivers: [
    {
      user_id: 'user-002',
      vehicle_type: 'moto',
      last_seen: new Date(Date.now() - 600000).toISOString(), // 10min ago
      lat: -1.9441,
      lng: 30.0619,
      ref_code: '234567',
      whatsapp_e164: '+250788222222'
    },
    {
      user_id: 'user-003',
      vehicle_type: 'cab',
      last_seen: new Date(Date.now() - 1800000).toISOString(), // 30min ago
      lat: -1.9536,
      lng: 30.0606,
      ref_code: '345678',
      whatsapp_e164: '+250788333333'
    }
  ],
  trips: [
    {
      id: 1,
      creator_user_id: 'user-001',
      role: 'passenger',
      vehicle_type: 'moto',
      created_at: new Date(Date.now() - 300000).toISOString(), // 5min ago
      status: 'open',
      lat: -1.9441,
      lng: 30.0619
    },
    {
      id: 2,
      creator_user_id: 'user-002',
      role: 'driver',
      vehicle_type: 'cab',
      created_at: new Date(Date.now() - 600000).toISOString(), // 10min ago
      status: 'open',
      lat: -1.9536,
      lng: 30.0606
    }
  ],
  subscriptions: [
    {
      id: 1,
      user_id: 'user-001',
      status: 'pending_review',
      started_at: null,
      expires_at: null,
      amount: 5000,
      proof_url: 'mock-proof-1.jpg',
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1hr ago
      user_ref_code: '123456',
      txn_id: null
    },
    {
      id: 2,
      user_id: 'user-002',
      status: 'active',
      started_at: new Date(Date.now() - 86400000).toISOString(),
      expires_at: new Date(Date.now() + 2592000000).toISOString(), // +30 days
      amount: 5000,
      proof_url: 'mock-proof-2.jpg',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      user_ref_code: '234567',
      txn_id: 'TX12345'
    }
  ],
  users: [
    {
      user_id: 'user-001',
      whatsapp_e164: '+250788111111',
      ref_code: '123456',
      credits_balance: 10,
      subscription_status: 'none',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      // Compatibility fields
      id: 'user-001',
      whatsapp_number: '0788111111',
      name: 'John Doe',
      profile_pic: null,
    },
    {
      user_id: 'user-002',
      whatsapp_e164: '+250788222222', 
      ref_code: '234567',
      credits_balance: 5,
      subscription_status: 'active',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      // Compatibility fields
      id: 'user-002',
      whatsapp_number: '0788222222',
      name: 'Jane Smith',
      profile_pic: null,
    },
    {
      user_id: 'user-003',
      whatsapp_e164: '+250788333333',
      ref_code: '345678',
      credits_balance: 0,
      subscription_status: 'none',
      created_at: new Date(Date.now() - 259200000).toISOString(),
      // Compatibility fields  
      id: 'user-003',
      whatsapp_number: '0788333333',
      name: 'Bob Wilson', 
      profile_pic: null,
    }
  ],
  settings: DEFAULT_SETTINGS
};

class MockAdapter {
  private data: MockData;

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.data = JSON.parse(stored);
      } catch {
        this.data = SEED_DATA;
        this.saveData();
      }
    } else {
      this.data = SEED_DATA;
      this.saveData();
    }
  }

  private saveData(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return { ...this.data.settings };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    this.data.settings = { ...this.data.settings, ...patch };
    this.saveData();
    return { ...this.data.settings };
  }

  // Users (compatibility)
  async listUsers(): Promise<User[]> {
    return [...this.data.users];
  }

  // Alias for compatibility
  async getUsers(): Promise<User[]> {
    return this.listUsers();
  }

  // Trips
  async getTrips(): Promise<Trip[]> {
    return [...this.data.trips];
  }

  // Subscriptions  
  async getSubscriptions(): Promise<Subscription[]> {
    return [...this.data.subscriptions];
  }

  async approveSubscription(id: number, txnId?: string): Promise<void> {
    const sub = this.data.subscriptions.find(s => s.id === id);
    if (sub) {
      sub.status = 'active';
      sub.started_at = new Date().toISOString();
      sub.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days
      if (txnId) sub.txn_id = txnId;
      this.saveData();
    }
  }

  async rejectSubscription(id: number): Promise<void> {
    const sub = this.data.subscriptions.find(s => s.id === id);
    if (sub) {
      sub.status = 'rejected';
      this.saveData();
    }
  }

  // Admin Stats
  async getAdminStats(): Promise<AdminStats> {
    const now = Date.now();
    const thirtyMinAgo = now - (30 * 60 * 1000);
    
    return {
      total_users: this.data.profiles.length,
      active_subscribers: this.data.subscriptions.filter(s => s.status === 'active').length,
      pending_subscriptions: this.data.subscriptions.filter(s => s.status === 'pending_review').length,
      total_trips: this.data.trips.length,
      drivers_online: this.data.drivers.filter(d => new Date(d.last_seen).getTime() > thirtyMinAgo).length,
      open_passenger_trips: this.data.trips.filter(t => t.role === 'passenger' && t.status === 'open').length,
      completed_trips_today: 0, // compatibility
      revenue_this_month: this.data.subscriptions.filter(s => s.status === 'active').length * 5000 // compatibility
    };
  }

  // Simulator Operations
  async simulateSeeNearbyDrivers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
  }): Promise<DriverPresence[]> {
    // Simple distance simulation - return drivers of matching type
    const drivers = this.data.drivers
      .filter(d => d.vehicle_type === params.vehicle_type)
      .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
      .slice(0, this.data.settings.max_results);
    
    return drivers;
  }

  async simulateSeeNearbyPassengers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    hasAccess?: boolean;
    driver_ref_code?: string;
  }): Promise<Trip[] | 'NO_ACCESS'> {
    if (!params.hasAccess) {
      return 'NO_ACCESS';
    }

    const trips = this.data.trips
      .filter(t => t.role === 'passenger' && t.vehicle_type === params.vehicle_type && t.status === 'open')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, this.data.settings.max_results);

    return trips;
  }

  async simulateScheduleTripPassenger(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    refCode?: string;
  }): Promise<Trip> {
    const trip: Trip = {
      id: Date.now(), // Simple ID generation
      creator_user_id: 'sim-user',
      role: 'passenger',
      vehicle_type: params.vehicle_type,
      created_at: new Date().toISOString(),
      status: 'open',
      lat: params.lat,
      lng: params.lng
    };

    this.data.trips.push(trip);
    this.saveData();
    return trip;
  }

  async simulateScheduleTripDriver(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    hasAccess: boolean;
    refCode?: string;
  }): Promise<Trip | 'NO_ACCESS'> {
    if (!params.hasAccess) {
      return 'NO_ACCESS';
    }

    const trip: Trip = {
      id: Date.now() + 1, // Simple ID generation
      creator_user_id: 'sim-user',
      role: 'driver',
      vehicle_type: params.vehicle_type,
      created_at: new Date().toISOString(),
      status: 'open',
      lat: params.lat,
      lng: params.lng
    };

    this.data.trips.push(trip);
    this.saveData();
    return trip;
  }

  // Get profiles by ref codes (for simulator lookups)
  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    return this.data.profiles.find(p => p.ref_code === refCode) || null;
  }

  // Dev utility
  async resetMockData(): Promise<void> {
    this.data = JSON.parse(JSON.stringify(SEED_DATA)); // Deep copy
    this.saveData();
  }
}

export const mockAdapter = new MockAdapter();
