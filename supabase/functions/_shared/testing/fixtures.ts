/**
 * Test Fixtures
 * Pre-defined test data for consistent testing
 */

// ============================================================================
// USER FIXTURES
// ============================================================================

export const TEST_USERS = {
  passenger: {
    user_id: "user-passenger-001",
    whatsapp_e164: "+250788100001",
    full_name: "John Passenger",
    language: "en",
    country_code: "RW",
    role: "user",
  },
  driver: {
    user_id: "user-driver-001",
    whatsapp_e164: "+250788200001",
    full_name: "Jane Driver",
    language: "en",
    country_code: "RW",
    role: "driver",
    vehicle_plate: "RAB 123A",
    vehicle_type: "moto",
  },
  admin: {
    user_id: "user-admin-001",
    whatsapp_e164: "+250788300001",
    full_name: "Admin User",
    language: "en",
    country_code: "RW",
    role: "admin",
  },
  newUser: {
    user_id: "user-new-001",
    whatsapp_e164: "+250788400001",
    full_name: null,
    language: "en",
    country_code: "RW",
    role: "user",
  },
};

// ============================================================================
// LOCATION FIXTURES
// ============================================================================

export const TEST_LOCATIONS = {
  kigaliCenter: {
    lat: -1.9403,
    lng: 29.8739,
    name: "Kigali City Center",
    address: "KN 2 Ave, Kigali",
  },
  nyamirambo: {
    lat: -1.9751,
    lng: 29.8419,
    name: "Nyamirambo",
    address: "Nyamirambo, Kigali",
  },
  kimironko: {
    lat: -1.9294,
    lng: 30.1127,
    name: "Kimironko",
    address: "Kimironko, Kigali",
  },
  airport: {
    lat: -1.9686,
    lng: 30.1395,
    name: "Kigali International Airport",
    address: "KK 15 Rd, Kigali",
  },
  remera: {
    lat: -1.9516,
    lng: 30.0913,
    name: "Remera",
    address: "Remera, Kigali",
  },
};

// ============================================================================
// TRIP FIXTURES
// ============================================================================

export const TEST_TRIPS = {
  openPassengerTrip: {
    id: "trip-passenger-open-001",
    user_id: TEST_USERS.passenger.user_id,
    role: "passenger",
    vehicle_type: "moto",
    pickup_lat: TEST_LOCATIONS.kigaliCenter.lat,
    pickup_lng: TEST_LOCATIONS.kigaliCenter.lng,
    dropoff_lat: TEST_LOCATIONS.kimironko.lat,
    dropoff_lng: TEST_LOCATIONS.kimironko.lng,
    status: "open",
    created_at: new Date().toISOString(),
  },
  openDriverTrip: {
    id: "trip-driver-open-001",
    user_id: TEST_USERS.driver.user_id,
    role: "driver",
    vehicle_type: "moto",
    pickup_lat: TEST_LOCATIONS.nyamirambo.lat,
    pickup_lng: TEST_LOCATIONS.nyamirambo.lng,
    status: "open",
    created_at: new Date().toISOString(),
  },
  matchedTrip: {
    id: "trip-matched-001",
    user_id: TEST_USERS.passenger.user_id,
    role: "passenger",
    vehicle_type: "moto",
    pickup_lat: TEST_LOCATIONS.kigaliCenter.lat,
    pickup_lng: TEST_LOCATIONS.kigaliCenter.lng,
    status: "matched",
    matched_driver_id: TEST_USERS.driver.user_id,
    created_at: new Date().toISOString(),
  },
  inProgressTrip: {
    id: "trip-in-progress-001",
    user_id: TEST_USERS.passenger.user_id,
    role: "passenger",
    vehicle_type: "moto",
    pickup_lat: TEST_LOCATIONS.kigaliCenter.lat,
    pickup_lng: TEST_LOCATIONS.kigaliCenter.lng,
    dropoff_lat: TEST_LOCATIONS.airport.lat,
    dropoff_lng: TEST_LOCATIONS.airport.lng,
    status: "in_progress",
    matched_driver_id: TEST_USERS.driver.user_id,
    started_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  completedTrip: {
    id: "trip-completed-001",
    user_id: TEST_USERS.passenger.user_id,
    role: "passenger",
    vehicle_type: "cab",
    pickup_lat: TEST_LOCATIONS.remera.lat,
    pickup_lng: TEST_LOCATIONS.remera.lng,
    dropoff_lat: TEST_LOCATIONS.airport.lat,
    dropoff_lng: TEST_LOCATIONS.airport.lng,
    status: "completed",
    matched_driver_id: TEST_USERS.driver.user_id,
    completed_at: new Date().toISOString(),
    fare_amount: 5000,
    rating: 5,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
};

// ============================================================================
// INSURANCE FIXTURES
// ============================================================================

export const TEST_INSURANCE = {
  pendingLead: {
    id: "lead-pending-001",
    user_id: TEST_USERS.passenger.user_id,
    whatsapp: TEST_USERS.passenger.whatsapp_e164,
    status: "received",
    created_at: new Date().toISOString(),
  },
  processedLead: {
    id: "lead-processed-001",
    user_id: TEST_USERS.passenger.user_id,
    whatsapp: TEST_USERS.passenger.whatsapp_e164,
    status: "ocr_ok",
    extracted: {
      policy_number: "POL-123456",
      insurer_name: "Sonarwa Insurance",
      vehicle_plate: "RAB 456B",
      expiry_date: "2026-01-15",
      coverage_type: "comprehensive",
    },
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  submittedClaim: {
    id: "claim-submitted-001",
    user_id: TEST_USERS.passenger.user_id,
    whatsapp: TEST_USERS.passenger.whatsapp_e164,
    claim_type: "claim_accident",
    description: "Minor fender bender at intersection. No injuries.",
    documents: ["doc-001", "doc-002"],
    status: "submitted",
    submitted_at: new Date().toISOString(),
  },
  approvedClaim: {
    id: "claim-approved-001",
    user_id: TEST_USERS.passenger.user_id,
    whatsapp: TEST_USERS.passenger.whatsapp_e164,
    claim_type: "claim_damage",
    description: "Windshield crack from road debris.",
    documents: ["doc-003"],
    status: "approved",
    submitted_at: new Date(Date.now() - 172800000).toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewer_comment: "Approved for windshield replacement.",
  },
};

// ============================================================================
// WALLET FIXTURES
// ============================================================================

export const TEST_WALLETS = {
  passengerWallet: {
    user_id: TEST_USERS.passenger.user_id,
    balance: 10000,
    currency: "tokens",
    last_transaction_at: new Date().toISOString(),
  },
  driverWallet: {
    user_id: TEST_USERS.driver.user_id,
    balance: 25000,
    currency: "tokens",
    last_transaction_at: new Date().toISOString(),
  },
  emptyWallet: {
    user_id: TEST_USERS.newUser.user_id,
    balance: 0,
    currency: "tokens",
    last_transaction_at: null,
  },
};

// ============================================================================
// MESSAGE FIXTURES
// ============================================================================

export const TEST_MESSAGES = {
  greetings: ["hi", "hello", "hey", "menu", "home", "start"],
  mobilityKeywords: ["ride", "driver", "taxi", "transport", "book"],
  insuranceKeywords: ["insurance", "cover", "claim", "policy"],
  profileKeywords: ["profile", "wallet", "balance", "transfer"],
  invalidInputs: [
    "'; DROP TABLE users; --",
    "<script>alert('xss')</script>",
    "1 OR 1=1",
  ],
};

// ============================================================================
// MENU FIXTURES
// ============================================================================

export const TEST_MENUS = {
  homeMenu: [
    { id: "rides", title: "Rides & Transport" },
    { id: "insurance", title: "Insurance" },
    { id: "jobs", title: "Jobs & Careers" },
    { id: "property", title: "Property Rentals" },
    { id: "wallet", title: "Wallet & Profile" },
    { id: "marketplace", title: "Marketplace" },
  ],
  mobilityMenu: [
    { id: "see_drivers", title: "Nearby drivers" },
    { id: "see_passengers", title: "Nearby passengers" },
    { id: "schedule_trip", title: "Schedule trip" },
    { id: "go_online", title: "Go online" },
  ],
  vehicleTypes: [
    { id: "veh_moto", title: "Moto taxi" },
    { id: "veh_cab", title: "Cab" },
    { id: "veh_lifan", title: "Lifan" },
    { id: "veh_truck", title: "Truck" },
    { id: "veh_others", title: "Other vehicles" },
  ],
};

console.log("✅ Test fixtures loaded");
