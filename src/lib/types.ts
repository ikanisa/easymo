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

// Updated User interface aligned with backend
export interface User {
  user_id: string;
  whatsapp_e164: string;
  ref_code: string;
  credits_balance: number;
  subscription_status: "active" | "expired" | "none";
  created_at: string;
  // Compatibility fields
  id?: string;
  whatsapp_number?: string;
  name?: string | null;
  profile_pic?: string | null;
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

// Tokens/Wallets Types
export interface Shop {
  id: string;
  name: string;
  short_code: string;
  is_active: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_code: string;
  whatsapp: string;
  status: 'active' | 'frozen' | 'expired';
  allow_any_shop: boolean;
  created_at: string;
  allowed_shop_ids?: string[];
}

export interface WalletBalance {
  wallet_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  type: 'issue' | 'spend' | 'reversal' | 'settlement';
  amount: number;
  wallet_id?: string;
  merchant_id?: string | null;
  created_at: string;
  shops?: { name: string; short_code: string };
}

export interface IssueTokensRequest {
  whatsapp: string;
  user_code: string;
  amount: number;
  allow_any_shop: boolean;
  allowed_shop_ids?: string[];
}

export interface IssueTokensResponse {
  ok: boolean;
  wallet_id: string;
  qr_secret: string;
  link?: string; // Generated from qr_secret
}

// WhatsApp Campaigns Types
export type QueueStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type QPayload =
  | { kind: "TEXT"; text: string }
  | { kind: "TEMPLATE"; name: string; language_code: string; components: any[] }
  | { kind: "INTERACTIVE"; interactive: any };

export type SendQueueRow = {
  id: number;
  campaign_id: number | null;
  msisdn_e164: string;
  payload: QPayload;
  attempt: number;
  next_attempt_at: string;
  status: QueueStatus;
};

export type SendLogRow = {
  id: number;
  queue_id: number;
  campaign_id: number | null;
  msisdn_e164: string;
  sent_at: string | null;
  provider_msg_id: string | null;
  delivery_status: string | null;
  error: string | null;
};

// Baskets Types
export interface Basket {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  status: 'draft' | 'active' | 'closed';
  goal_minor?: number;
  currency: string;
  momo_target?: string;
  owner_profile_id?: string;
  owner_whatsapp?: string;
  created_at: string;
  updated_at: string;
  share_token?: string;
  join_token?: string;
}

export interface BasketMember {
  basket_id: string;
  user_id: string;
  profile_id?: string;
  whatsapp?: string;
  role: 'member' | 'admin';
  joined_at: string;
  total_contributed?: number;
}

export interface BasketContribution {
  id: string;
  basket_id: string;
  contributor_user_id: string;
  amount_minor: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
}

// Marketplace Types
export interface MarketplaceCategory {
  id: string;
  slug: string;
  label: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  category_id?: number;
  owner_whatsapp: string;
  owner_user_id?: string;
  catalog_url?: string;
  location_text?: string;
  lat?: number;
  lng?: number;
  is_active: boolean;
  status?: string;
  created_at: string;
}