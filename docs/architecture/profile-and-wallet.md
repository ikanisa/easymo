# Profile & Wallet Architecture

**Status**: Design Phase  
**Last Updated**: 2025-11-22  
**Purpose**: Isolate non-agent workflows (Profile, Wallet, QR, Saved Data)

## Overview

Profile is the **only** non-agent workflow in the new architecture. All agent interactions (1-8) happen via WhatsApp natural language. Profile provides UI/API access to user data, wallet, and entity management.

## Profile Components

### 1. MoMo QR Code 💳
**Purpose**: Personal QR code for MoMo payments

**Features**:
- View personal QR code
- Generate new QR if needed
- Share QR via WhatsApp/other channels
- View QR scan history

**Data**: `profiles.momo_qr_code`, `qr_scan_events`

**Access**: WhatsApp menu item 9 → "Show my QR"

### 2. Wallet & Tokens 💰
**Purpose**: Manage EasyMO wallet balance and tokens

**Features**:
- **View Balance**: Current wallet balance and token count
- **Transaction History**: All deposits, withdrawals, token usage
- **Earn Tokens**: Complete tasks/referrals to earn
- **Use Tokens**: Apply tokens for discounts
- **Cash Out**: Withdraw balance to MoMo

**Data**: `wallets`, `tokens`, `transactions`, `token_earn_rules`, `token_usage_events`

**Access**: WhatsApp menu item 9 → "My Wallet"

**APIs**:
```typescript
// Read balance
GET /profile/wallet/balance
Response: { balance: number, tokens: number, currency: 'RWF' }

// Get transaction history  
GET /profile/wallet/transactions?limit=20&offset=0
Response: { transactions: Transaction[], total: number }

// Cash out (with validation)
POST /profile/wallet/cashout
Body: { amount: number, momoNumber: string }
Response: { transactionId: string, status: 'pending' }

// Earn tokens
POST /profile/tokens/earn
Body: { ruleId: string, metadata: any }
Response: { tokensEarned: number, newBalance: number }

// Use tokens
POST /profile/tokens/use
Body: { amount: number, orderId?: string }
Response: { tokensUsed: number, newBalance: number }
```

### 3. My Stuff 📦
**Purpose**: View all entities owned/managed across agents

**Sub-sections**:

#### 3.1 My Businesses 🏪
**Source**: Business Broker Agent  
**Data**: `businesses` WHERE user_id = current_user  
**Features**:
- List all businesses owned/managed
- View business details
- Edit via "Talk to Business Broker Agent" button

#### 3.2 My Vehicles 🚗  
**Source**: Rides Agent  
**Data**: `vehicles` WHERE owner_id = current_user  
**Features**:
- List registered vehicles
- View vehicle details (plate, model, insurance)
- Edit via "Talk to Rides Agent" button

#### 3.3 My Properties 🏠
**Source**: Real Estate Agent  
**Data**: `properties` WHERE landlord_id = current_user  
**Features**:
- List properties for rent/sale
- View property details and applications
- Edit via "Talk to Real Estate Agent" button

#### 3.4 My Jobs 💼
**Source**: Jobs Agent  
**Data**: `job_posts` WHERE poster_id = current_user + `job_applications` WHERE applicant_id = current_user  
**Features**:
- List jobs posted (if employer)
- List job applications (if seeker)
- View application status
- Edit via "Talk to Jobs Agent" button

#### 3.5 My Listings 🌾
**Source**: Farmer Agent  
**Data**: `produce_listings` WHERE farmer_id = current_user  
**Features**:
- List produce for sale
- View listing details and buyers
- Edit via "Talk to Farmer Agent" button

#### 3.6 My Insurance Policies 🛡️
**Source**: Insurance Agent  
**Data**: `insurance_policies` WHERE policyholder_id = current_user  
**Features**:
- List active/expired policies
- View policy details and coverage
- Renew via "Talk to Insurance Agent" button

#### 3.7 My Trips 🚕
**Source**: Rides Agent  
**Data**: `trips` WHERE passenger_id = current_user OR driver_id = current_user  
**Features**:
- List past/upcoming trips
- View trip details (route, cost, driver/passenger)
- Book new trip via "Talk to Rides Agent" button

**Common Pattern**:
```typescript
// Generic "My Stuff" API
GET /profile/stuff/{category}  // category = businesses | vehicles | properties | jobs | listings | policies | trips
Response: {
  items: EntitySummary[],
  total: number,
  agentSlug: string  // to launch conversation
}

interface EntitySummary {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: Date;
  thumbnailUrl?: string;
}
```

### 4. Saved Locations 📍
**Purpose**: Store favorite locations for reuse by agents

**Features**:
- **Add Location**: Save from WhatsApp location share
- **Label Locations**: Home, Work, Gym, Mom's House, etc.
- **View Locations**: List all saved
- **Edit/Delete**: Manage saved locations
- **Agent Reuse**: Agents can reference saved locations without asking user to share again

**Data**: `saved_locations`

**Schema**:
```sql
CREATE TABLE saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES whatsapp_users(id),
  label text NOT NULL,  -- 'Home', 'Work', etc.
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  address text,
  notes text,
  is_primary boolean DEFAULT false,  -- primary address for deliveries
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Access**: WhatsApp menu item 9 → "Saved Locations"

**APIs**:
```typescript
// List saved locations
GET /profile/locations
Response: { locations: SavedLocation[] }

// Add location
POST /profile/locations
Body: { label: string, latitude: number, longitude: number, address?: string }
Response: { id: string, location: SavedLocation }

// Update location
PATCH /profile/locations/:id
Body: { label?: string, address?: string, is_primary?: boolean }
Response: { location: SavedLocation }

// Delete location
DELETE /profile/locations/:id
Response: { success: boolean }
```

**Agent Integration**:
Agents can fetch user's saved locations via agent tool:
```typescript
// Agent tool: get_saved_locations
async function getSavedLocations(userId: string): Promise<SavedLocation[]> {
  const { data } = await supabase
    .from('saved_locations')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });
  
  return data;
}

// Example in agent prompt:
// "User's saved locations: Home (Kimironko), Work (CBD), Mom's House (Nyamirambo)"
// "If user says 'send to work', use saved location instead of asking again"
```

## Architecture Principles

### 1. Pure CRUD APIs
Profile APIs should be **simple** and **stateless**:
- Read: Fetch data from domain tables
- Create/Update/Delete: Validate and persist
- No complex business logic (that's in agents)
- No multi-step wizards (that's in agents)

### 2. No Agent Logic in Profile
**❌ Wrong**: Profile API creates order, matches driver, sends notifications  
**✅ Right**: Profile API shows user's trips; creating new trip launches Rides Agent

### 3. Agent Helper Endpoints
Agents need to access user profile data:

```typescript
// Helper: Get user preferences (used by all agents)
GET /internal/profile/:userId/preferences
Response: {
  preferredLanguage: 'en',
  savedLocations: Location[],
  dietaryPreferences: string[],  // for Waiter
  jobPreferences: { skills: [], location: '' },  // for Jobs
  // etc.
}

// Helper: Get recent entities (for context)
GET /internal/profile/:userId/recent/:category
Response: {
  recentOrders: Order[],  // last 5 orders for Waiter
  recentTrips: Trip[],  // last 5 trips for Rides
  // etc.
}
```

**Security**: These endpoints are **internal only**, called by agent runtime, not exposed to public.

## Data Isolation

### Profile Tables (Manage Here)
- `profiles` - User profile metadata
- `wallets` - Wallet balances
- `tokens` - Token balances/rules
- `transactions` - Financial transactions
- `saved_locations` - Saved addresses
- `user_preferences` - General preferences

### Domain Tables (Read-Only from Profile)
- `businesses`, `vehicles`, `properties`, `job_posts`, `produce_listings`, `insurance_policies`, `trips`
- Profile can **read** these to show "My Stuff"
- Profile **cannot** write to these (only agents can)

## WhatsApp Integration

### Profile Menu Flow
```
User sends: "9️⃣" or "Profile"
    ↓
Bot replies with submenu:
1️⃣ My QR Code
2️⃣ My Wallet
3️⃣ My Stuff
4️⃣ Saved Locations
5️⃣ Back to Home
    ↓
User selects option
    ↓
Bot calls Profile API
    ↓
Bot sends formatted response
```

### Example: View Wallet
```
User: "2️⃣"
Bot: "💰 Your Wallet
Balance: 5,000 RWF
Tokens: 120 🪙

Recent:
• Nov 20: +50 RWF (Order #1234)
• Nov 19: -500 RWF (Trip to CBD)

What would you like to do?
1️⃣ View all transactions
2️⃣ Cash out
3️⃣ Earn tokens
4️⃣ Back"
```

### Example: My Stuff
```
User: "3️⃣"
Bot: "📦 My Stuff

1️⃣ My Businesses (2)
2️⃣ My Vehicles (1)
3️⃣ My Properties (0)
4️⃣ My Jobs (3 applications)
5️⃣ My Listings (5)
6️⃣ My Insurance (1 policy)
7️⃣ My Trips (12 total)
8️⃣ Back"

User: "1️⃣"
Bot: "🏪 My Businesses

1️⃣ KG Coffee Shop - Active
   📍 Kimironko
   ⭐ 4.5 stars, 23 reviews

2️⃣ Mama Aisha Restaurant - Pending
   📍 Remera
   ⏳ Verification pending

To edit, say 'Edit business 1' or tap below:
[Talk to Business Broker Agent]"
```

## Admin Panel Integration

### Profile Dashboard (admin-app/)
Staff can view/manage user profiles:

**Features**:
- Search users by phone/name
- View user profile summary
- View wallet balance and transactions
- Manually adjust balance (with reason)
- View all user entities (businesses, trips, etc.)
- View saved locations (for support)

**Access Control**:
- Admin role required
- All actions logged
- Audit trail in `admin_actions` table

## Migration Tasks

### Extract Profile Module
```
Current state: Profile logic scattered across edge functions

Target state:
packages/profile/
  ├── src/
  │   ├── wallet/
  │   │   ├── balance.ts
  │   │   ├── transactions.ts
  │   │   ├── cashout.ts
  │   │   └── tokens.ts
  │   ├── stuff/
  │   │   ├── businesses.ts
  │   │   ├── vehicles.ts
  │   │   ├── properties.ts
  │   │   ├── jobs.ts
  │   │   ├── listings.ts
  │   │   ├── policies.ts
  │   │   └── trips.ts
  │   ├── locations/
  │   │   ├── saved.ts
  │   │   └── recent.ts
  │   ├── qr/
  │   │   └── momo.ts
  │   └── helpers/
  │       ├── preferences.ts
  │       └── context.ts
  ├── package.json
  └── tsconfig.json
```

### Clean Up Wallet Functions
**Move from** scattered functions to unified module:
- `momo-allocator/` → `profile/wallet/momo.ts`
- `momo-charge/` → `profile/wallet/momo.ts`
- `revolut-charge/` → `profile/wallet/revolut.ts`
- `qr-resolve/`, `qr_info/` → `profile/qr/momo.ts`
- `wa-webhook-wallet/` → Remove (use main wa-webhook with Profile menu)

### Create Helper APIs
**New internal endpoints** for agent access:
```typescript
// services/agent-core/src/profile-helpers/

export async function getUserPreferences(userId: string) {
  // Fetch from profiles, saved_locations, user_preferences
}

export async function getRecentEntities(userId: string, category: string, limit: number) {
  // Fetch recent orders/trips/etc. for context
}

export async function getUserContext(userId: string, agentSlug: string) {
  // Build full context for agent runtime
}
```

## Testing

### Profile API Tests
```typescript
describe('Profile API', () => {
  describe('Wallet', () => {
    it('should return wallet balance', async () => {
      const balance = await getWalletBalance(userId);
      expect(balance.balance).toBeGreaterThanOrEqual(0);
      expect(balance.tokens).toBeGreaterThanOrEqual(0);
    });

    it('should not allow negative cashout', async () => {
      await expect(cashOut(userId, 999999)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('My Stuff', () => {
    it('should list user businesses', async () => {
      const businesses = await getMyBusinesses(userId);
      expect(businesses.items).toBeInstanceOf(Array);
    });

    it('should not include other users entities', async () => {
      const trips = await getMyTrips(userId);
      trips.items.forEach(trip => {
        expect([trip.passenger_id, trip.driver_id]).toContain(userId);
      });
    });
  });

  describe('Saved Locations', () => {
    it('should save location with label', async () => {
      const location = await saveLocation(userId, {
        label: 'Home',
        latitude: -1.9441,
        longitude: 30.0619,
      });
      expect(location.id).toBeDefined();
      expect(location.label).toBe('Home');
    });
  });
});
```

### Agent Helper Tests
```typescript
describe('Agent Profile Helpers', () => {
  it('should get user saved locations for agent', async () => {
    const locations = await getUserContext(userId, 'rides');
    expect(locations.savedLocations).toBeDefined();
    expect(locations.savedLocations.length).toBeGreaterThan(0);
  });

  it('should get recent orders for waiter agent', async () => {
    const context = await getUserContext(userId, 'waiter');
    expect(context.recentOrders).toBeDefined();
  });
});
```

## Performance

### Caching Strategy
- **Wallet balance**: Cache for 30s (frequently accessed)
- **Saved locations**: Cache for 5 min (rarely changes)
- **My Stuff counts**: Cache for 1 min
- **Transaction history**: No cache (must be real-time)

### Database Indexes
```sql
-- Wallet queries
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Saved locations
CREATE INDEX idx_saved_locations_user_id ON saved_locations(user_id);

-- My Stuff queries (already exist, verify)
CREATE INDEX idx_businesses_user_id ON businesses(user_id);
CREATE INDEX idx_vehicles_owner_id ON vehicles(owner_id);
CREATE INDEX idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX idx_job_posts_poster_id ON job_posts(poster_id);
CREATE INDEX idx_produce_listings_farmer_id ON produce_listings(farmer_id);
CREATE INDEX idx_trips_passenger_id ON trips(passenger_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
```

## Security

### Authorization
- Users can only access their own data
- Row-level security (RLS) on all tables
- Admin role required for cross-user access

### Data Validation
```typescript
// Validate wallet operations
function validateCashOut(balance: number, amount: number) {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (amount > balance) throw new Error('Insufficient balance');
  if (amount < MIN_CASHOUT) throw new Error(`Minimum cashout is ${MIN_CASHOUT}`);
}

// Validate location
function validateLocation(lat: number, lng: number) {
  if (lat < -90 || lat > 90) throw new Error('Invalid latitude');
  if (lng < -180 || lng > 180) throw new Error('Invalid longitude');
}
```

### PII Protection
- Mask sensitive data in logs
- Encrypt wallet transactions
- Audit trail for balance changes

## Next Steps

1. Create `packages/profile/` module
2. Extract wallet logic from scattered functions
3. Implement "My Stuff" aggregation APIs
4. Create agent helper endpoints
5. Add comprehensive tests
6. Deploy with feature flags
7. Update WhatsApp menu to use Profile module

**Document Status**: ✅ Design Complete  
**Implementation Status**: 🚧 Pending  
**Owner**: EasyMO Engineering Team
