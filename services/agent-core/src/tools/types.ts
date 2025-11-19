export type ToolAttribution = {
  trace_id: string;
  org_id: string;
  user_id: string;
  convo_id?: string;
};

export type ToolAttributionDraft = {
  traceId?: string;
  orgId?: string;
  userId?: string;
  convoId?: string;
};

export interface SearchSupabaseRequest {
  tenant_id: string;
  table: string;
  filters: Record<string, unknown>;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  attribution: ToolAttribution;
}

export interface SearchSupabaseResponse {
  items: Array<Record<string, unknown>>;
  count: number;
}

export interface CreateListingRequest {
  tenant_id: string;
  farm_id: string;
  produce_id: string;
  quantity: number;
  unit_type: string;
  price_per_unit: number;
  currency: string;
  harvest_date?: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  attribution: ToolAttribution;
}

export interface CreateListingResponse {
  listing_id: string;
  status: string;
  farm_id: string;
  produce_id: string;
}

export interface CreateOrderRequest {
  tenant_id: string;
  buyer_profile_id: string;
  listing_id?: string;
  produce_id?: string;
  quantity: number;
  unit_type: string;
  currency: string;
  ceiling_total?: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  attribution: ToolAttribution;
}

export interface CreateOrderResponse {
  order_id: string;
  status: string;
  buyer_profile_id: string;
}

export interface CreateMatchRequest {
  tenant_id: string;
  order_id: string;
  listing_id: string;
  score?: number;
  metadata?: Record<string, unknown>;
  attribution: ToolAttribution;
}

export interface CreateMatchResponse {
  match_id: string;
  status: string;
  order_id: string;
  listing_id: string;
}

export interface RecordPaymentRequest {
  tenant_id: string;
  order_id: string;
  payer_profile_id: string;
  amount: number;
  currency: string;
  provider?: string;
  provider_ref?: string;
  metadata?: Record<string, unknown>;
  attribution: ToolAttribution;
}

export interface RecordPaymentResponse {
  payment_id: string;
  status: string;
  order_id: string;
}

export type SearchSupabaseInput = {
  tenantId: string;
  table: string;
  filters: Record<string, unknown>;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  attribution?: ToolAttributionDraft;
};

export type CreateListingInput = {
  tenantId: string;
  farmId: string;
  produceId: string;
  quantity: number;
  unitType: string;
  pricePerUnit: number;
  currency: string;
  harvestDate?: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  attribution?: ToolAttributionDraft;
};

export type CreateOrderInput = {
  tenantId: string;
  buyerProfileId: string;
  listingId?: string;
  produceId?: string;
  quantity: number;
  unitType: string;
  currency: string;
  ceilingTotal?: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  attribution?: ToolAttributionDraft;
};

export type CreateMatchInput = {
  tenantId: string;
  orderId: string;
  listingId: string;
  score?: number;
  metadata?: Record<string, unknown>;
  attribution?: ToolAttributionDraft;
};

export type RecordPaymentInput = {
  tenantId: string;
  orderId: string;
  payerProfileId: string;
  amount: number;
  currency: string;
  provider?: string;
  providerRef?: string;
  metadata?: Record<string, unknown>;
  attribution?: ToolAttributionDraft;
};
