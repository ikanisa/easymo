# AI Agents Integration - Correct Flow Specification

## Flow Overview

AI agents should **take over AFTER** user provides required information, not replace the initial collection steps.

---

## 1. Nearby Drivers 🚖

### User Flow:
1. User taps "Nearby Drivers"
2. **System asks**: Choose vehicle type (Moto, Cab, Lifan, Truck, Others)
3. User selects vehicle type
4. **System asks**: Share pickup location (or choose from saved: home, school, work, other)
5. User shares pickup location
6. **System asks**: Share dropoff/destination location
7. User shares dropoff location
8. **AI AGENT TAKES OVER**:
   - Looks in database for nearby drivers (matching vehicle type, proximity)
   - Sends messages to drivers
   - Negotiates price on behalf of passenger
   - Collects up to 3 best options
   - **Time limit**: 5 minutes max
   - If 5 min passes with < 3 options: Send what it has + ask if user wants more time
9. **System presents**: 3 options to user to choose from
10. User selects preferred driver

### Integration Point:
- **File**: `domains/mobility/nearby.ts`
- **Function**: After `handleNearbyLocation()` receives BOTH pickup and dropoff
- **Current issue**: Flow only collects ONE location, needs modification to collect dropoff too

---

## 2. Nearby Passengers 👥

### User Flow:
NO AI AGENT NEEDED. Keep current implementation.
- View nearby passengers based on current location
- Or based on scheduled trip
- Direct database query, no negotiation needed

---

## 3. Schedule Trip 🚦

### User Flow:
1. User taps "Schedule Trip"
2. **System asks**: Choose role (Driver/Passenger)
3. User selects role
4. **System asks**: Choose vehicle type
5. User selects vehicle
6. **System asks**: Share pickup location
7. User shares pickup
8. **System asks**: Share dropoff location (optional)
9. User shares dropoff or skips
10. **System asks**: Travel time (Now, In an hour, Evening, Tomorrow, or manual entry with calendar picker if WhatsApp allows)
11. User selects/enters time
12. **System**: Trip scheduled successfully

**AI AGENT WORKS IN BACKGROUND** (not 5-minute window):
- Continuously looks for best matches (drivers ↔ passengers)
- When match found: Send notification to both parties
- If passenger scheduled trip: Agent negotiates with drivers on behalf of passenger
- **Pattern Learning**: Agent learns user's travel patterns to anticipate needs
- **Recurring trips**: User can set "everyday at 7am" or "weekdays at 8am"
- Agent handles these automatically

### Integration Point:
- **File**: `domains/mobility/schedule.ts`
- **Function**: After trip is scheduled (in `createTripAndDeliverMatches()`)
- **Background Job**: Agent runs separately, sends notifications when matches found

---

## 4. Nearby Pharmacies 💊

### User Flow:
1. User taps "Nearby Pharmacies"
2. **System asks**: Share your location
3. User shares location
4. **System asks**: (Optional) Share image of prescription/medicine OR type medicine name
5. User provides medicine info (optional)
6. **AI AGENT TAKES OVER**:
   - Looks in database for nearby pharmacies
   - Sends messages to pharmacies (chat)
   - Asks which ones have these medicines
   - Asks prices on behalf of user
   - Collects up to 3 best options
   - **Time limit**: 5 minutes max
   - If 5 min passes: Send what it has + ask for more time
7. **System presents**: 3 options to user
8. User selects preferred pharmacy

### Integration Point:
- **File**: `domains/ai-agents/handlers.ts` → `handleAINearbyPharmacies()`
- **Trigger**: After location + optional medicine info collected

---

## 5. Nearby Quincailleries 🔧

### User Flow:
1. User taps "Nearby Quincailleries"
2. **System asks**: Share your location
3. User shares location
4. **System asks**: (Optional) Share image of items you need OR type item names
5. User provides item info (optional)
6. **AI AGENT TAKES OVER**:
   - Looks in database for nearby quincailleries (hardware stores)
   - Sends messages to stores (chat)
   - Asks which ones have these items
   - Asks prices on behalf of user
   - Collects up to 3 best options
   - **Time limit**: 5 minutes max
   - If 5 min passes: Send what it has + ask for more time
7. **System presents**: 3 options to user
8. User selects preferred store

### Integration Point:
- **File**: `domains/ai-agents/handlers.ts` → `handleAINearbyQuincailleries()`
- **Trigger**: After location + optional item info collected

---

## 6. Shops 🛒

### User Flow:
User taps "Shops" → Choose action:

#### A. Add Shop:
1. **System asks**: Share shop location
2. User shares location
3. **System asks**: Shop name
4. User types name
5. **System asks**: Short description (salon, supermarket, spare parts, liquor store, cosmetics, OR top 5 products sold)
6. User types description
7. **System asks**: (Optional) WhatsApp catalog URL
8. User provides URL or skips
9. **System**: Success! Shop added to database

NO AI AGENT for adding shops.

#### B. View Nearby Shops:
1. **System asks**: Share your location
2. User shares location
3. **System asks**: (Optional) Share image of items OR type item names
4. User provides item info (optional)
5. **AI AGENT TAKES OVER** (same as pharmacies/quincailleries):
   - Looks in database for nearby shops
   - Chats with shops
   - Asks which ones have items
   - Asks prices
   - Collects 3 best options
   - **Time limit**: 5 minutes
7. **System presents**: 3 options
8. User selects shop

### Integration Point:
- **File**: `domains/marketplace/index.ts` + `domains/ai-agents/handlers.ts`
- **Functions**: Existing add flow + new `handleAINearbyShops()`

---

## 7. Bars & Restaurants 🍽️

### User Flow:
User taps "Bars & Restaurants" → Choose:

#### A. View Bars/Restaurants:
Keep current implementation (browse, view menus, etc.)

#### B. Add Bar/Restaurant:
Keep current implementation

#### C. **NEW**: Dine-In AI Waiter:
1. User scans QR code at table
2. **Opens WhatsApp** with pre-filled message to bar/restaurant
3. **AI WAITER AGENT starts conversation**:
   - "Welcome to [Restaurant Name]! I'm your virtual waiter."
   - "Here's our menu:" (displays items in chat with numbers)
   - User types: "1, 4, 9" (item numbers)
   - Agent: "You've ordered: [Item 1], [Item 4], [Item 9]. Confirm?" 
   - User: "Yes"
   - Agent: "Order confirmed! Your items will be ready shortly."
4. **Bar/Restaurant sees**:
   - All conversations between agent and guests
   - Orders grouped by table number
   - Real-time order status

### Integration Point:
- **File**: `domains/dinein/` (existing) + NEW `domains/ai-agents/waiter.ts`
- **Trigger**: QR code scan with table number parameter

---

## 8. Property Rentals 🏠

### User Flow:
User taps "Property Rentals" → Choose:

#### A. Add Property:
1. **System asks**: Rental type (Short-term: 1 day-3 months, OR Long-term: 3+ months)
2. User selects type
3. **System asks**: Number of bedrooms
4. User selects bedrooms
5. **System asks**: Price/Budget range
6. User enters range
7. **System asks**: Share property location
8. User shares location
9. **System**: Success! Property listed in database

NO AI AGENT for adding properties.

#### B. Find Property:
1. **System asks**: Rental type (Short-term OR Long-term)
2. User selects type
3. **System asks**: Number of bedrooms
4. User selects bedrooms
5. **System asks**: Budget range
6. User enters range
7. **System asks**: Share desired location
8. User shares location
9. **AI AGENT TAKES OVER**:
   - Looks in database for matching properties
   - Chats with property owners
   - Negotiates prices on behalf of user
   - Collects 3 best options
   - **Time limit**: 5 minutes
10. **System presents**: 3 property options
11. User selects preferred property

### Integration Point:
- **File**: `domains/ai-agents/handlers.ts` → `handleAIPropertyRental()`
- **Trigger**: After all search criteria collected

---

## 9. MOMO QR Code & Tokens 💰

### User Flow:
NO AI AGENT. Keep current implementation.
- User taps "MOMO QR Code and Tokens"
- Choose between QR code or Tokens
- Follow existing flow
- **Note**: Needs restructuring to be more minimalist and simple

---

## 10. Motor Insurance 🚗

### User Flow:
NO AI AGENT. Keep current implementation as-is.

---

## Summary: AI Agent Integration Points

| Feature | AI Agent Trigger Point | Time Limit |
|---------|------------------------|------------|
| Nearby Drivers | After pickup + dropoff locations provided | 5 min |
| Schedule Trip | Background job after trip scheduled | No limit (future trip) |
| Nearby Pharmacies | After location + medicine info provided | 5 min |
| Nearby Quincailleries | After location + item info provided | 5 min |
| Shops (View) | After location + item info provided | 5 min |
| Property Rentals (Find) | After search criteria provided | 5 min |
| Dine-In Waiter | After QR scan → immediate conversation | No limit |

---

## Implementation Checklist

### Phase 1: Fix Nearby Drivers Flow
- [ ] Modify `handleNearbyLocation()` to also collect dropoff
- [ ] Add AI agent call after BOTH locations collected
- [ ] Implement 5-minute timeout with progress updates

### Phase 2: Pharmacy/Quincaillerie/Shops
- [ ] Flows already collect location first
- [ ] Add AI agent calls at correct points
- [ ] Implement 5-minute timeout

### Phase 3: Property Rentals
- [ ] Modify to collect all search criteria first
- [ ] Then call AI agent
- [ ] Implement 5-minute timeout

### Phase 4: Schedule Trip Background Agent
- [ ] Separate background job (not immediate)
- [ ] Pattern learning algorithm
- [ ] Notification system

### Phase 5: Dine-In AI Waiter
- [ ] QR code generation per table
- [ ] Conversational agent
- [ ] Real-time order dashboard for bar

---

**Key Principle**: AI agents are assistants that work AFTER information is gathered, not replacements for the information gathering flow.
