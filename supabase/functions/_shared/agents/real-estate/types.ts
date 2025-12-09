/**
 * Real Estate AI Agent Types
 *
 * Defines explicit role handshake and state machine for the Real Estate AI agent.
 * Addresses RE1: User role not made explicit (buyer vs tenant vs landlord vs agent)
 *
 * Roles:
 * - BUYER_TENANT: Looking to buy or rent a property
 * - LANDLORD_OWNER: Listing a property for rent/sale
 * - AGENCY_STAFF: Managing properties for an agency
 */

/**
 * Real Estate user roles
 */
export type RealEstateRole = "buyer_tenant" | "landlord_owner" | "agency_staff";

/**
 * Real Estate state keys
 */
export const REAL_ESTATE_STATE_KEYS = {
  /** Initial state - role not yet determined */
  ROLE_SELECTION: "re_role_selection",
  /** User is searching for properties (buyer/tenant) */
  PROPERTY_SEARCH: "re_property_search",
  /** User is listing a property (landlord) */
  PROPERTY_LISTING: "re_property_listing",
  /** User is managing agency properties (staff) */
  AGENCY_MANAGEMENT: "re_agency_management",
  /** Conversational AI mode */
  AI_CHAT: "re_ai_chat",
  /** Viewing property details */
  VIEWING_PROPERTY: "re_viewing_property",
  /** Scheduling a visit */
  SCHEDULING_VISIT: "re_scheduling_visit",
} as const;

export type RealEstateStateKey = (typeof REAL_ESTATE_STATE_KEYS)[keyof typeof REAL_ESTATE_STATE_KEYS];

/**
 * Real Estate session context - stored in user_state.data
 */
export interface RealEstateSessionContext {
  /** User's identified role */
  role: RealEstateRole | null;
  /** Entry source (whatsapp, pwa, deep_link) */
  entrySource: "whatsapp" | "pwa" | "deep_link";
  /** User's last known location */
  lastLocation: {
    lat: number;
    lng: number;
    capturedAt: string;
  } | null;
  /** Search criteria (for buyers/tenants) */
  searchCriteria: {
    rentalType?: "short_term" | "long_term" | "purchase";
    propertyType?: string;
    bedrooms?: number;
    budgetMin?: number;
    budgetMax?: number;
    currency?: string;
    location?: string;
  } | null;
  /** Property being listed (for landlords) */
  listingDraft: {
    rentalType?: string;
    propertyType?: string;
    bedrooms?: number;
    price?: number;
    currency?: string;
    priceUnit?: string;
  } | null;
  /** Saved properties (for buyers/tenants) */
  savedPropertyIds: string[];
  /** Lead ID if a lead was created */
  leadId: string | null;
}

/**
 * Real Estate state with typed data
 */
export interface RealEstateState {
  key: RealEstateStateKey;
  data: RealEstateSessionContext;
  createdAt?: string;
  expiresAt?: string;
}

/**
 * Allowed state transitions for Real Estate agent
 */
export const REAL_ESTATE_STATE_TRANSITIONS: Record<RealEstateStateKey, RealEstateStateKey[]> = {
  [REAL_ESTATE_STATE_KEYS.ROLE_SELECTION]: [
    REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH,
    REAL_ESTATE_STATE_KEYS.PROPERTY_LISTING,
    REAL_ESTATE_STATE_KEYS.AGENCY_MANAGEMENT,
    REAL_ESTATE_STATE_KEYS.AI_CHAT,
  ],
  [REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH]: [
    REAL_ESTATE_STATE_KEYS.VIEWING_PROPERTY,
    REAL_ESTATE_STATE_KEYS.SCHEDULING_VISIT,
    REAL_ESTATE_STATE_KEYS.AI_CHAT,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
  [REAL_ESTATE_STATE_KEYS.PROPERTY_LISTING]: [
    REAL_ESTATE_STATE_KEYS.AI_CHAT,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
  [REAL_ESTATE_STATE_KEYS.AGENCY_MANAGEMENT]: [
    REAL_ESTATE_STATE_KEYS.AI_CHAT,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
  [REAL_ESTATE_STATE_KEYS.AI_CHAT]: [
    REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH,
    REAL_ESTATE_STATE_KEYS.PROPERTY_LISTING,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
  [REAL_ESTATE_STATE_KEYS.VIEWING_PROPERTY]: [
    REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH,
    REAL_ESTATE_STATE_KEYS.SCHEDULING_VISIT,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
  [REAL_ESTATE_STATE_KEYS.SCHEDULING_VISIT]: [
    REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH,
    REAL_ESTATE_STATE_KEYS.VIEWING_PROPERTY,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
  ],
};

/**
 * Default real estate session context
 */
export function createDefaultRealEstateContext(
  entrySource: "whatsapp" | "pwa" | "deep_link" = "whatsapp"
): RealEstateSessionContext {
  return {
    role: null,
    entrySource,
    lastLocation: null,
    searchCriteria: null,
    listingDraft: null,
    savedPropertyIds: [],
    leadId: null,
  };
}

/**
 * Role display labels for WhatsApp messages
 */
export const ROLE_LABELS: Record<RealEstateRole, { emoji: string; title: string; description: string }> = {
  buyer_tenant: {
    emoji: "🏠",
    title: "Looking for Property",
    description: "I want to rent or buy a property",
  },
  landlord_owner: {
    emoji: "🏢",
    title: "Listing Property",
    description: "I have a property to rent or sell",
  },
  agency_staff: {
    emoji: "👔",
    title: "Real Estate Agent",
    description: "I manage properties for clients",
  },
};

/**
 * Lead information for CRM integration (RE3)
 */
export interface RealEstateLead {
  id?: string;
  userId: string;
  leadType: "rent" | "buy";
  propertyType?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  timeline?: "urgent" | "flexible" | "exploring";
  status: "new" | "contacted" | "viewing_scheduled" | "closed";
  source: "whatsapp" | "pwa" | "deep_link";
  createdAt: string;
  updatedAt: string;
}
