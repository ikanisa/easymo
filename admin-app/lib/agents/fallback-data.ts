/**
 * Centralized Fallback Mock Data for All Agents
 * 
 * Used when:
 * - Supabase is unavailable
 * - Queries fail
 * - Network errors occur
 * - For testing and development
 */

export const fallbackDriverRequests = [
  {
    id: "dr-mock-1",
    passenger: "John Doe",
    phone: "+250788123456",
    pickup: "Kigali City",
    dropoff: "Airport",
    status: "negotiating",
    price: 15000,
    eta: 25,
    distance: 12.5,
    createdAt: new Date().toISOString(),
    offers: [
      { driver: "Driver A", price: 14000, eta: 20, rating: 4.8 },
      { driver: "Driver B", price: 15000, eta: 25, rating: 4.5 },
    ],
  },
  {
    id: "dr-mock-2",
    passenger: "Jane Smith",
    phone: "+250788234567",
    pickup: "Kimironko",
    dropoff: "Nyabugogo",
    status: "accepted",
    price: 8000,
    eta: 15,
    distance: 5.3,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    offers: [],
  },
];

export const fallbackPharmacyRequests = [
  {
    id: "ph-mock-1",
    patient: "Alice Mukamana",
    phone: "+250788345678",
    medications: ["Amoxicillin 500mg", "Paracetamol 1g"],
    status: "awaiting_quotes",
    urgency: "same_day",
    deliveryMode: "courier",
    createdAt: new Date().toISOString(),
    quotes: [
      { vendor: "CityPharma", price: 18500, etaMinutes: 35, stockStatus: "In stock" },
      { vendor: "Nyamirambo Health", price: 19000, etaMinutes: 50, stockStatus: "Limited stock" },
    ],
  },
  {
    id: "ph-mock-2",
    patient: "Bob Niyonzima",
    phone: "+250788456789",
    medications: ["Ibuprofen 400mg"],
    status: "pending",
    urgency: "standard",
    deliveryMode: "pickup",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    quotes: [],
  },
];

export const fallbackPropertyRentals = [
  {
    id: "pr-mock-1",
    title: "Modern 2BR Apartment",
    location: "Kacyiru",
    price: 450000,
    bedrooms: 2,
    bathrooms: 2,
    size: 120,
    furnished: true,
    status: "available",
    landlord: "Property Co.",
    phone: "+250788567890",
    description: "Spacious apartment with modern amenities",
    images: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: "pr-mock-2",
    title: "Studio Apartment",
    location: "Kimihurura",
    price: 250000,
    bedrooms: 1,
    bathrooms: 1,
    size: 45,
    furnished: false,
    status: "available",
    landlord: "Homes Ltd",
    phone: "+250788678901",
    description: "Cozy studio in quiet neighborhood",
    images: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const fallbackQuincaillerieItems = [
  {
    id: "qn-mock-1",
    name: "Cement - 50kg bag",
    category: "Construction Materials",
    price: 12000,
    unit: "bag",
    vendor: "BuildMart",
    phone: "+250788789012",
    inStock: true,
    minOrder: 10,
    deliveryAvailable: true,
    description: "High-quality Portland cement",
  },
  {
    id: "qn-mock-2",
    name: "Steel Rods - 12mm",
    category: "Construction Materials",
    price: 8500,
    unit: "piece",
    vendor: "Hardware Plus",
    phone: "+250788890123",
    inStock: true,
    minOrder: 20,
    deliveryAvailable: true,
    description: "Grade 60 steel reinforcement bars",
  },
];

export const fallbackScheduledTrips = [
  {
    id: "st-mock-1",
    passenger: "Carol Uwera",
    phone: "+250788901234",
    pickup: "Home - Kimironko",
    dropoff: "Airport",
    scheduledTime: new Date(Date.now() + 86400000).toISOString(),
    status: "scheduled",
    price: 18000,
    driver: null,
    recurring: false,
    notes: "Flight at 10 AM",
  },
  {
    id: "st-mock-2",
    passenger: "David Habimana",
    phone: "+250788012345",
    pickup: "Office - CBD",
    dropoff: "Nyamirambo",
    scheduledTime: new Date(Date.now() + 172800000).toISOString(),
    status: "pending",
    price: 7000,
    driver: null,
    recurring: true,
    notes: "Regular commute",
  },
];

export const fallbackMarketplaceItems = [
  {
    id: "mp-mock-1",
    title: "Laptop - Dell XPS 13",
    category: "Electronics",
    price: 850000,
    seller: "Tech Store",
    phone: "+250789123456",
    condition: "new",
    location: "Kigali",
    images: [],
    description: "Brand new, sealed box",
    status: "available",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mp-mock-2",
    title: "iPhone 13 - 128GB",
    category: "Electronics",
    price: 650000,
    seller: "Mobile Hub",
    phone: "+250789234567",
    condition: "used",
    location: "Remera",
    images: [],
    description: "Excellent condition, 6 months old",
    status: "available",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
];

export const fallbackAgentSessions = [
  {
    id: "as-mock-1",
    userId: "user-123",
    agentType: "driver-negotiation",
    status: "active",
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    messageCount: 5,
    context: { pickup: "Kigali", dropoff: "Airport" },
  },
  {
    id: "as-mock-2",
    userId: "user-456",
    agentType: "pharmacy",
    status: "completed",
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    lastActivity: new Date(Date.now() - 1800000).toISOString(),
    messageCount: 8,
    context: { medications: ["Paracetamol"] },
  },
];

/**
 * Get fallback data for a specific agent type
 */
export function getFallbackData(agentType: string): any[] {
  switch (agentType) {
    case "driver-negotiation":
    case "driver-requests":
      return fallbackDriverRequests;
    
    case "pharmacy":
    case "pharmacy-requests":
      return fallbackPharmacyRequests;
    
    case "property-rental":
    case "property-rentals":
      return fallbackPropertyRentals;
    
    case "quincaillerie":
    case "hardware":
      return fallbackQuincaillerieItems;
    
    case "schedule-trip":
    case "scheduled-trips":
      return fallbackScheduledTrips;
    
    case "marketplace":
      return fallbackMarketplaceItems;
    
    case "agent-sessions":
      return fallbackAgentSessions;
    
    default:
      return [];
  }
}
