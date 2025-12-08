/**
 * Application Constants
 * Centralized constants used across all services
 */

// ============================================================================
// SERVICE NAMES
// ============================================================================

export const SERVICES = {
  CORE: "wa-webhook-core",
  PROFILE: "wa-webhook-profile",
  MOBILITY: "wa-webhook-mobility",
  INSURANCE: "wa-webhook-insurance",
} as const;

export type ServiceName = typeof SERVICES[keyof typeof SERVICES];

// ============================================================================
// WHATSAPP IDS
// ============================================================================

export const WA_IDS = {
  // Home Menu
  HOME_MENU: "home_menu",
  BACK_MENU: "back_menu",
  BACK_HOME: "back_home",

  // Profile & Wallet
  PROFILE_VIEW: "profile_view",
  PROFILE_EDIT: "profile_edit",
  PROFILE_SETTINGS: "profile_settings",
  WALLET_BALANCE: "wallet_balance",
  WALLET_TRANSFER: "wallet_transfer",
  WALLET_HISTORY: "wallet_history",
  WALLET_DEPOSIT: "wallet_deposit",

  // Mobility
  RIDES_MENU: "rides_menu",
  SEE_DRIVERS: "see_drivers",
  SEE_PASSENGERS: "see_passengers",
  SCHEDULE_TRIP: "schedule_trip",
  GO_ONLINE: "go_online",
  GO_OFFLINE: "go_offline",
  MOBILITY_CHANGE_VEHICLE: "mobility_change_vehicle",
  LOCATION_SAVED_LIST: "location_saved_list",
  USE_CACHED_LOCATION: "use_cached_location",

  // Vehicle Types
  VEH_MOTO: "veh_moto",
  VEH_CAB: "veh_cab",
  VEH_LIFAN: "veh_lifan",
  VEH_TRUCK: "veh_truck",
  VEH_OTHERS: "veh_others",

  // Trip Lifecycle
  TRIP_START: "trip_start",
  TRIP_ARRIVED: "trip_arrived",
  TRIP_PICKED_UP: "trip_picked_up",
  TRIP_COMPLETE: "trip_complete",
  TRIP_CANCEL: "trip_cancel",

  // Insurance
  INSURANCE_MENU: "insurance_menu",
  INSURANCE_SUBMIT: "insurance_submit",
  INSURANCE_HELP: "insurance_help",
  INSURANCE_CLAIM: "insurance_claim",

  // Verification
  VERIFY_LICENSE: "verify_license",
  VERIFY_INSURANCE: "verify_insurance",
  VERIFY_STATUS: "verify_status",

  // Payment
  PAYMENT_PAID: "payment_paid",
  PAYMENT_SKIP: "payment_skip",
  PAYMENT_MOMO: "payment_momo",
} as const;

export type WaId = typeof WA_IDS[keyof typeof WA_IDS];

// ============================================================================
// STATE KEYS
// ============================================================================

export const STATE_KEYS = {
  // Common
  HOME: "home",
  
  // Profile
  PROFILE_EDIT_NAME: "profile_edit_name",
  PROFILE_EDIT_EMAIL: "profile_edit_email",
  PROFILE_EDIT_LANGUAGE: "profile_edit_language",
  
  // Wallet
  WALLET_TRANSFER_RECIPIENT: "wallet_transfer_recipient",
  WALLET_TRANSFER_AMOUNT: "wallet_transfer_amount",
  WALLET_TRANSFER_CONFIRM: "wallet_transfer_confirm",
  
  // Mobility
  MOBILITY_MENU: "mobility_menu",
  MOBILITY_NEARBY_SELECT: "mobility_nearby_select",
  MOBILITY_NEARBY_LOCATION: "mobility_nearby_location",
  MOBILITY_NEARBY_RESULTS: "mobility_nearby_results",
  SCHEDULE_ROLE: "schedule_role",
  SCHEDULE_VEHICLE: "schedule_vehicle",
  SCHEDULE_LOCATION: "schedule_location",
  SCHEDULE_DROPOFF: "schedule_dropoff",
  SCHEDULE_TIME: "schedule_time",
  GO_ONLINE_PROMPT: "go_online_prompt",
  TRIP_IN_PROGRESS: "trip_in_progress",
  
  // Insurance
  INSURANCE_MENU: "insurance_menu",
  INSURANCE_UPLOAD: "ins_wait_doc",
  CLAIM_TYPE: "claim_type",
  CLAIM_DESCRIPTION: "claim_description",
  CLAIM_DOCUMENTS: "claim_documents",
  CLAIM_SUBMITTED: "claim_submitted",
} as const;

export type StateKey = typeof STATE_KEYS[keyof typeof STATE_KEYS];

// ============================================================================
// VEHICLE TYPES
// ============================================================================

export const VEHICLE_TYPES = {
  MOTO: "moto",
  CAB: "cab",
  LIFAN: "lifan",
  TRUCK: "truck",
  OTHERS: "others",
} as const;

export type VehicleType = typeof VEHICLE_TYPES[keyof typeof VEHICLE_TYPES];

export const VEHICLE_TYPE_LIST = Object.values(VEHICLE_TYPES);

// ============================================================================
// TRIP STATUSES
// ============================================================================

export const TRIP_STATUS = {
  OPEN: "open",
  MATCHED: "matched",
  STARTED: "started",
  ARRIVED: "arrived",
  PICKED_UP: "picked_up",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type TripStatus = typeof TRIP_STATUS[keyof typeof TRIP_STATUS];

// ============================================================================
// CLAIM TYPES
// ============================================================================

export const CLAIM_TYPES = {
  ACCIDENT: "claim_accident",
  THEFT: "claim_theft",
  DAMAGE: "claim_damage",
  THIRD_PARTY: "claim_third_party",
} as const;

export type ClaimType = typeof CLAIM_TYPES[keyof typeof CLAIM_TYPES];

// ============================================================================
// CLAIM STATUSES
// ============================================================================

export const CLAIM_STATUS = {
  SUBMITTED: "submitted",
  REVIEWING: "reviewing",
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING_INFO: "pending_info",
  CLOSED: "closed",
} as const;

export type ClaimStatus = typeof CLAIM_STATUS[keyof typeof CLAIM_STATUS];

// ============================================================================
// SUPPORTED LANGUAGES
// ============================================================================
// CRITICAL: Kinyarwanda (rw) is BLOCKED from UI translation
// Do NOT add 'rw' to this list - it is intentionally excluded

export const LANGUAGES = {
  EN: "en",
  FR: "fr",
  SW: "sw",
  ES: "es",
  PT: "pt",
  DE: "de",
} as const;

export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];

export const DEFAULT_LANGUAGE: Language = LANGUAGES.EN;

// Explicitly blocked language (DO NOT USE in UI)
export const BLOCKED_UI_LANGUAGES = ["rw", "rw-RW"] as const;

// ============================================================================
// LIMITS & THRESHOLDS
// ============================================================================

export const LIMITS = {
  // Rate limiting
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  
  // Nearby search
  SEARCH_RADIUS_DEFAULT_KM: 15,
  SEARCH_RADIUS_MAX_KM: 25,
  SEARCH_RESULTS_MAX: 9,
  SEARCH_WINDOW_DAYS: 30,
  
  // Location cache
  LOCATION_CACHE_MINUTES: 30,
  
  // Wallet
  WALLET_TRANSFER_MIN: 1,
  WALLET_TRANSFER_MAX: 1000000,
  
  // Content
  MAX_BODY_SIZE_BYTES: 1024 * 1024, // 1MB
  MAX_DOCUMENT_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  
  // Text
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 5000,
  
  // WhatsApp
  WA_BUTTON_TITLE_MAX: 20,
  WA_LIST_TITLE_MAX: 24,
  WA_LIST_ROWS_MAX: 10,
} as const;

// ============================================================================
// TIMEOUTS
// ============================================================================

export const TIMEOUTS = {
  // API calls
  WA_API_TIMEOUT_MS: 10000,
  DB_QUERY_TIMEOUT_MS: 5000,
  OCR_TIMEOUT_MS: 30000,
  
  // Service routing
  ROUTER_TIMEOUT_MS: 4000,
  
  // State expiry
  STATE_TTL_SECONDS: 3600, // 1 hour
  SESSION_TTL_SECONDS: 86400, // 24 hours
} as const;

// ============================================================================
// REGEX PATTERNS
// ============================================================================

export const PATTERNS = {
  PHONE_E164: /^\+[1-9]\d{1,14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  VEHICLE_PLATE_RW: /^R[A-Z]{2}\s?\d{3}[A-Z]$/i,
} as const;
