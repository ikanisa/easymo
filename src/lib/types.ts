/**
 * ULTRA-MINIMAL WhatsApp Mobility - Types
 * Clean, focused types for Phase-1 mock and Phase-2 real implementation
 */

export type VehicleType = 'moto' | 'cab' | 'lifan' | 'truck' | 'others';

export interface Profile {
  user_id: string;
  whatsapp_e164: string;   // +2507…
  ref_code: string;        // '935384'
  credits_balance: number; // 0+ (gate)
  created_at: string;
}

export interface DriverPresence {
  user_id: string;
  vehicle_type: VehicleType;
  last_seen: string;      // ISO string
  // Phase 1 simulator only:
  lat: number; 
  lng: number;
}

export interface Trip {
  id: number;
  creator_user_id: string;
  role: 'passenger' | 'driver';
  vehicle_type: VehicleType;
  created_at: string;     // ISO string, used for "most recent first"
  status?: 'open' | 'expired'; // compatibility
  // Phase 1 sim only:
  lat: number; 
  lng: number; // pickup location
}

export type SubStatus = 'pending_review' | 'active' | 'expired' | 'rejected';

export interface Subscription {
  id: number;
  user_id: string;
  status: SubStatus;
  started_at: string | null;
  expires_at: string | null;
  amount: number; // RWF
  proof_url: string | null; // media id or placeholder
  created_at: string;
  // Compatibility fields for existing components
  user_ref_code?: string;
  txn_id?: string | null;
}

// Compatibility User interface for existing components
export interface User {
  id: string;
  whatsapp_number: string;
  name: string | null;
  profile_pic: string | null;
  ref_code: string;
  subscription_status: "active" | "expired" | "none";
  created_at: string;
}

export interface Settings {
  subscription_price: number;   // 5000
  search_radius_km: number;     // 5.0 (sim hint)
  max_results: number;          // 10
  momo_payee_number: string;    // 07XXXXXXX
  support_phone_e164: string;   // +2507…
  admin_whatsapp_numbers?: string; // comma-separated (for future WA admin)
}

export interface AdminStats {
  total_users: number;
  active_subscribers: number;
  pending_subscriptions: number;
  total_trips: number;
  drivers_online: number;
  open_passenger_trips: number;
  // Compatibility fields
  completed_trips_today?: number;
  revenue_this_month?: number;
}

// WhatsApp Simulator Types
export interface SimLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface SimMessage {
  type: 'text' | 'buttons' | 'list' | 'link';
  content: string;
  buttons?: string[];
  listItems?: Array<{ id: string; title: string; description?: string }>;
  linkUrl?: string;
}

// WhatsApp Admin Command Types (future Phase-2)
export interface WACommand {
  kind: 'approve' | 'reject' | 'list' | 'invalid';
  subId?: number;
  txnId?: string;
  reason?: string;
  error?: string;
}

export interface WAConsoleLog {
  timestamp: string;
  type: 'incoming' | 'outgoing' | 'system' | 'error';
  from?: string;
  message: string;
}