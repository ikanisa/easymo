/**
 * Tool Contract Types for EasyMO Platform
 * 
 * Defines standardized types for all agent tools following the platform conventions.
 * All tools MUST return ToolResult<T> and include AttributionContext.
 */

// =============================================================================
// Core Tool Types
// =============================================================================

/**
 * Standard tool result type - ALL tools must return this structure
 */
export interface ToolResult<T = any> {
  ok: boolean;
  data?: T;
  error?: ToolError;
}

/**
 * Tool error structure - user-safe messages only
 */
export interface ToolError {
  code: string;
  msg: string;
}

/**
 * Attribution context required for RLS and tracing
 */
export interface AttributionContext {
  trace_id: string;
  org_id: string;
  user_id: string;
  convo_id?: string;
}

/**
 * Standard error codes across all tools
 */
export enum ToolErrorCode {
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  EXPIRED = 'EXPIRED',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// =============================================================================
// A. Messaging & Orchestration Tools
// =============================================================================

export interface NotifyStaffParams extends AttributionContext {
  channel: 'inbox' | 'slack' | 'sms';
  payload: {
    convo_id: string;
    reason: string;
    summary: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
}

export interface NotifyStaffResult {
  ticket_id: string;
  estimated_response_time?: string;
}

export interface SearchSupabaseParams extends AttributionContext {
  table: string;
  filters: Record<string, any>;
  limit?: number;
  order?: {
    column: string;
    ascending: boolean;
  };
}

export interface SearchSupabaseResult {
  items: Array<Record<string, any>>;
  count: number;
}

// =============================================================================
// B. Commerce & Operations Tools
// =============================================================================

export interface InventoryCheckParams extends AttributionContext {
  items: Array<{sku?: string; name?: string}>;
  venue_id?: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  available: boolean;
}

export interface InventoryCheckResult {
  items: InventoryItem[];
}

export interface OrderCreateParams extends AttributionContext {
  items: Array<{
    sku: string;
    name: string;
    qty: number;
    price: number;
  }>;
  venue_id: string;
  table_no?: string;
  notes?: string;
  customer_id: string;
}

export interface OrderCreateResult {
  order_id: string;
  total: number;
  currency: string;
  estimated_time?: string;
}

export interface OrderStatusUpdateParams {
  order_id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string;
  trace_id: string;
}

export interface OrderStatusUpdateResult {
  order_id: string;
  status: string;
  updated_at: string;
}

export interface ReservationBookParams extends AttributionContext {
  venue_id: string;
  when: string; // ISO 8601
  size: number;
  name: string;
  phone: string;
  notes?: string;
}

export interface ReservationBookResult {
  reservation_id: string;
  confirmation_code: string;
}

// =============================================================================
// C. Maps & Mobility Tools
// =============================================================================

export interface MapsGeosearchParams {
  lat: number;
  lng: number;
  radius: number; // meters
  kind: 'driver' | 'venue' | 'pharmacy' | 'shop' | 'property';
  filters?: Record<string, any>;
  limit?: number;
  trace_id: string;
}

export interface GeosearchResult {
  id: string;
  name: string;
  distance: number; // meters
  lat: number; // coarse precision
  lng: number; // coarse precision
  metadata?: Record<string, any>;
}

export interface MapsGeosearchResult {
  results: GeosearchResult[];
}

export interface TripPriceEstimateParams {
  origin: {lat: number; lng: number; name?: string};
  dest: {lat: number; lng: number; name?: string};
  when: string; // ISO 8601
  pax: number;
  vehicle_type?: string;
  trace_id: string;
}

export interface TripPriceEstimateResult {
  estimate: number;
  currency: string;
  window: {min: number; max: number};
  eta_minutes: number;
}

// =============================================================================
// D. Insurance Tools
// =============================================================================

export interface OcrExtractParams extends AttributionContext {
  file_url: string;
  document_type: 'vehicle_registration' | 'id_card' | 'license' | 'policy';
}

export interface OcrExtractResult {
  fields: Record<string, string>;
  confidence: number; // 0-1
  extracted_at: string;
}

export interface PriceInsuranceParams extends AttributionContext {
  type: 'motor' | 'travel' | 'health';
  category: string;
  coverage_period_days: number;
  vehicle?: {make: string; model: string; year: number};
  driver?: {age: number; experience_years: number};
  destination?: string;
}

export interface PriceInsuranceResult {
  premium: number;
  currency: string;
  breakdown: {
    base: number;
    tax: number;
    fees: number;
  };
  insurer: string;
  validity: string; // ISO 8601
}

export interface GeneratePdfParams extends AttributionContext {
  template_id: string;
  data: Record<string, any>;
  locale?: string;
}

export interface GeneratePdfResult {
  pdf_url: string;
  expires_at: string;
}

// =============================================================================
// E. Payments Tools
// =============================================================================

export interface MomoChargeParams extends AttributionContext {
  amount: number;
  currency: string;
  phone: string;
  memo: string;
  metadata?: Record<string, any>;
  idempotency_key: string; // Required for financial ops
}

export interface MomoChargeResult {
  payment_link: string;
  momo_ref: string;
  expires_at: string;
}

// =============================================================================
// F. Property & Legal Tools
// =============================================================================

export interface PropertySearchParams extends AttributionContext {
  filters: {
    price_min?: number;
    price_max?: number;
    bedrooms?: number;
    area?: string;
    pets_allowed?: boolean;
    parking?: boolean;
  };
  limit?: number;
}

export interface PropertyListing {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  area: string;
  photos: string[];
  available_from: string;
}

export interface PropertySearchResult {
  listings: PropertyListing[];
}

export interface ScheduleViewingParams extends AttributionContext {
  listing_id: string;
  when: string; // ISO 8601
  name: string;
  phone: string;
  notes?: string;
}

export interface ScheduleViewingResult {
  event_id: string;
  address: string; // Full address revealed after booking
  contact: string;
}

export interface CaseIntakeParams extends AttributionContext {
  category: string;
  summary: string;
  docs: string[]; // URLs
  client_name: string;
  client_phone: string;
}

export interface CaseIntakeResult {
  case_id: string;
  reference_number: string;
}

// =============================================================================
// G. Marketing & Analytics Tools
// =============================================================================

export interface BroadcastScheduleParams extends AttributionContext {
  template_id: string; // Pre-approved WhatsApp template
  audience: {
    segment?: string;
    filters?: Record<string, any>;
  };
  when: string; // ISO 8601
  variables?: Record<string, string>;
}

export interface BroadcastScheduleResult {
  campaign_id: string;
  estimated_reach: number;
  scheduled_at: string;
}

export interface AnalyticsLogParams extends AttributionContext {
  event: string;
  props: Record<string, any>;
}

export interface AnalyticsLogResult {
  logged_at: string;
}

// =============================================================================
// H. Sora-2 Video Tools
// =============================================================================

export interface SoraPrompt {
  scene: string;
  cinematography: {
    camera_shot: string;
    lighting_palette: string;
  };
  actions: Array<{time: string; description: string}>;
  dialogue?: string;
}

export interface SoraParams {
  model: 'sora-2' | 'sora-2-pro';
  size: '1280x720' | '720x1280' | '1024x1792' | '1792x1024';
  seconds: 4 | 8 | 12;
}

export interface SoraGenerateVideoParams extends AttributionContext {
  prompt: SoraPrompt;
  params: SoraParams;
  brand_kit_id: string;
  reference_images?: string[];
}

export interface SoraGenerateVideoResult {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  preview_url?: string;
  estimated_completion?: string;
}

// =============================================================================
// Tool Function Type Definitions
// =============================================================================

export type NotifyStaffTool = (params: NotifyStaffParams) => Promise<ToolResult<NotifyStaffResult>>;
export type SearchSupabaseTool = (params: SearchSupabaseParams) => Promise<ToolResult<SearchSupabaseResult>>;
export type InventoryCheckTool = (params: InventoryCheckParams) => Promise<ToolResult<InventoryCheckResult>>;
export type OrderCreateTool = (params: OrderCreateParams) => Promise<ToolResult<OrderCreateResult>>;
export type OrderStatusUpdateTool = (params: OrderStatusUpdateParams) => Promise<ToolResult<OrderStatusUpdateResult>>;
export type ReservationBookTool = (params: ReservationBookParams) => Promise<ToolResult<ReservationBookResult>>;
export type MapsGeosearchTool = (params: MapsGeosearchParams) => Promise<ToolResult<MapsGeosearchResult>>;
export type TripPriceEstimateTool = (params: TripPriceEstimateParams) => Promise<ToolResult<TripPriceEstimateResult>>;
export type OcrExtractTool = (params: OcrExtractParams) => Promise<ToolResult<OcrExtractResult>>;
export type PriceInsuranceTool = (params: PriceInsuranceParams) => Promise<ToolResult<PriceInsuranceResult>>;
export type GeneratePdfTool = (params: GeneratePdfParams) => Promise<ToolResult<GeneratePdfResult>>;
export type MomoChargeTool = (params: MomoChargeParams) => Promise<ToolResult<MomoChargeResult>>;
export type PropertySearchTool = (params: PropertySearchParams) => Promise<ToolResult<PropertySearchResult>>;
export type ScheduleViewingTool = (params: ScheduleViewingParams) => Promise<ToolResult<ScheduleViewingResult>>;
export type CaseIntakeTool = (params: CaseIntakeParams) => Promise<ToolResult<CaseIntakeResult>>;
export type BroadcastScheduleTool = (params: BroadcastScheduleParams) => Promise<ToolResult<BroadcastScheduleResult>>;
export type AnalyticsLogTool = (params: AnalyticsLogParams) => Promise<ToolResult<AnalyticsLogResult>>;
export type SoraGenerateVideoTool = (params: SoraGenerateVideoParams) => Promise<ToolResult<SoraGenerateVideoResult>>;

// =============================================================================
// Tool Registry Type
// =============================================================================

export interface ToolRegistry {
  notify_staff: NotifyStaffTool;
  search_supabase: SearchSupabaseTool;
  inventory_check: InventoryCheckTool;
  order_create: OrderCreateTool;
  order_status_update: OrderStatusUpdateTool;
  reservation_book: ReservationBookTool;
  maps_geosearch: MapsGeosearchTool;
  trip_price_estimate: TripPriceEstimateTool;
  ocr_extract: OcrExtractTool;
  price_insurance: PriceInsuranceTool;
  generate_pdf: GeneratePdfTool;
  momo_charge: MomoChargeTool;
  property_search: PropertySearchTool;
  schedule_viewing: ScheduleViewingTool;
  case_intake: CaseIntakeTool;
  broadcast_schedule: BroadcastScheduleTool;
  analytics_log: AnalyticsLogTool;
  sora_generate_video: SoraGenerateVideoTool;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a successful tool result
 */
export function successResult<T>(data: T): ToolResult<T> {
  return {
    ok: true,
    data
  };
}

/**
 * Create an error tool result
 */
export function errorResult(code: ToolErrorCode | string, msg: string): ToolResult<never> {
  return {
    ok: false,
    error: {
      code,
      msg
    }
  };
}

/**
 * Validate attribution context
 */
export function validateAttribution(ctx: Partial<AttributionContext>): ctx is AttributionContext {
  return !!(ctx.trace_id && ctx.org_id && ctx.user_id);
}
