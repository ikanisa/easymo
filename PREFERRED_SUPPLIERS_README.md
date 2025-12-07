# Preferred Suppliers Network - Complete Implementation

## 🎯 Overview

The **Preferred Suppliers Network** is an intelligent supplier prioritization system that enables EasyMO to recommend trusted partners who offer special benefits (discounts, free delivery, loyalty points) to users purchasing goods through the Call Center AGI or Buy & Sell agent.

## ✨ Key Features

### 1. **Priority Supplier Search**
- **Partnership Tiers**: Platinum → Gold → Silver → Standard (descending priority)
- **Location-Based**: Finds suppliers within specified radius (default 10km)
- **Product Matching**: Smart keyword search across product names and categories
- **Benefits Highlighting**: Automatic calculation of discounts and savings

### 2. **Supplier Benefits**
- **Discounts**: Percentage-based or fixed amount
- **Free Delivery**: Conditional on minimum order amount or location
- **Cashback**: Post-purchase rewards
- **Loyalty Points**: Recurring customer benefits
- **Bundle Deals**: Special package offers

### 3. **Smart Recommendations**
The system prioritizes suppliers based on:
1. Partnership tier (Platinum > Gold > Silver > Standard)
2. Priority score (manually set by admins)
3. Distance from user
4. Product availability and stock
5. Benefits offered

## 🗄️ Database Schema

### Tables Created

#### `preferred_suppliers`
Core supplier information and partnership details.

```sql
Columns:
- id: UUID (primary key)
- business_name: TEXT (required)
- business_type: TEXT (grocery, pharmacy, hardware, farm_produce, general)
- contact_phone, contact_email, whatsapp_number: TEXT
- address, city, district, country, lat, lng: Location data
- partnership_tier: TEXT (platinum, gold, silver, standard)
- commission_rate: NUMERIC (% EasyMO takes)
- priority_score: INTEGER (higher = more priority)
- is_active: BOOLEAN
- partnership_started_at, partnership_expires_at: TIMESTAMPTZ
```

#### `supplier_products`
Products offered by each supplier.

```sql
Columns:
- supplier_id: UUID (foreign key)
- product_name, product_category: TEXT
- unit: TEXT (kg, piece, liter, box, bag)
- price_per_unit: NUMERIC
- min_quantity, max_quantity: NUMERIC
- in_stock: BOOLEAN
- stock_quantity: NUMERIC
- search_keywords: TEXT[] (for better matching)
```

#### `supplier_benefits`
Benefits and promotions offered.

```sql
Columns:
- supplier_id: UUID (foreign key)
- benefit_type: TEXT (discount, free_delivery, cashback, loyalty_points, bundle_deal)
- discount_percent, discount_amount: NUMERIC
- min_order_amount: NUMERIC (to qualify)
- delivery_radius_km: NUMERIC
- valid_from, valid_until: TIMESTAMPTZ
```

#### `supplier_service_areas`
Delivery coverage zones.

```sql
Columns:
- supplier_id: UUID (foreign key)
- area_name: TEXT (Kigali, Nyarugenge, etc.)
- area_type: TEXT (city, district, sector, radius)
- radius_km: NUMERIC
- delivery_fee: NUMERIC
- min_order_for_free_delivery: NUMERIC
```

#### `supplier_orders`
Track orders placed with suppliers.

```sql
Columns:
- order_number: TEXT (auto-generated: SUP-YYYYMMDD-XXXXXX)
- supplier_id, user_id: UUID (foreign keys)
- items: JSONB (product array)
- subtotal, delivery_fee, discount_amount, total_amount: NUMERIC
- benefits_applied: JSONB
- delivery_address, delivery_lat, delivery_lng: TEXT/NUMERIC
- status: TEXT (pending, confirmed, preparing, out_for_delivery, delivered, cancelled)
- payment_status: TEXT (pending, paid, failed, refunded)
```

## 🔧 PostgreSQL Functions

### `search_preferred_suppliers()`
Main search function used by the AI agents.

```sql
Parameters:
- p_product_query: TEXT (required) - Product search term
- p_user_lat: NUMERIC (optional) - User latitude
- p_user_lng: NUMERIC (optional) - User longitude
- p_radius_km: NUMERIC (default 10) - Search radius
- p_limit: INTEGER (default 5) - Max results

Returns:
- supplier_id, business_name, contact_phone, whatsapp_number
- distance_km, product_name, price_per_unit, unit
- is_preferred, partnership_tier, priority_score
- benefits (JSONB array), total_price
- delivery_available (boolean)
```

**Sorting Priority:**
1. Platinum → Gold → Silver → Standard
2. Priority score (descending)
3. Distance (ascending)

### `search_suppliers_combined()`
Future-ready function to combine preferred suppliers + regular businesses for comprehensive results.

## 🤖 AI Agent Integration

### Tool: `search_suppliers`

**Added to:**
- Call Center AGI (priority 40)
- Buy & Sell Agent (priority 10)

**Parameters:**
```json
{
  "product_query": "potatoes",        // REQUIRED
  "quantity": 10,                      // OPTIONAL
  "unit": "kg",                        // OPTIONAL
  "user_lat": -1.9441,                 // OPTIONAL (uses profile if missing)
  "user_lng": 30.0619,                 // OPTIONAL
  "max_radius_km": 10,                 // OPTIONAL (default 10)
  "category": "grocery"                // OPTIONAL
}
```

**Returns:**
```json
{
  "suppliers": [
    {
      "supplier_id": "uuid",
      "business_name": "Kigali Fresh Market",
      "business_type": "grocery",
      "distance_km": 2.3,
      "product_name": "Potatoes (Irish)",
      "price_per_unit": 800,
      "unit": "kg",
      "partnership_tier": "platinum",
      "total_price": 8000,
      "discounted_price": 7200,
      "has_discount": true,
      "savings": 800,
      "benefits_text": "✅ 10% discount for EasyMO users\n✅ Free delivery over 5,000 RWF",
      "benefits": [
        {
          "type": "discount",
          "discount_percent": 10,
          "min_order": 5000
        },
        {
          "type": "free_delivery",
          "min_order": 5000
        }
      ]
    }
  ],
  "total_found": 3,
  "product_query": "potatoes",
  "quantity": 10,
  "unit": "kg"
}
```

## 💬 Agent Response Format

The Call Center AGI has been instructed to format supplier recommendations as follows:

```
🏆 RECOMMENDED (EasyMO Partner):
Kigali Fresh Market - 2.3km away
✅ 10% discount for EasyMO users
✅ Free delivery over 5,000 RWF
💰 800 RWF/kg → 7,200 RWF for 10kg (with discount: 6,480 RWF)

Other options:
2. Kimironko Market Vendor - 3.1km - 8,500 RWF
3. Remera Grocers - 4.5km - 9,000 RWF
4. Nyabugogo Wholesale - 6.2km - 7,500 RWF (min 20kg)
5. Kicukiro Fresh - 8.7km - 8,200 RWF

Would you like me to connect you with Kigali Fresh Market?
```

## 🖥️ Admin Panel

### Location
`/admin-app/app/(panel)/suppliers/`

### Features
- **Dashboard Overview**:
  - Total suppliers count
  - Platinum/Gold/Silver partner counts
  - Total products available
  - Active/Inactive status

- **Suppliers List**:
  - Sortable table
  - Partnership tier badges with star icons
  - Product and benefit counts
  - Contact information
  - Location display
  - Commission rates

### Planned Features (Future PRs)
- ✅ Add/Edit supplier form
- ✅ Manage products per supplier
- ✅ Configure benefits and promotions
- ✅ Service area mapping
- ✅ Order management interface
- ✅ Performance analytics
- ✅ Bulk import/export

## 📊 Example Use Cases

### Use Case 1: Basic Grocery Search
**User**: "I need 10kg of potatoes"

**Agent Flow**:
1. Extract: `product_query="potatoes"`, `quantity=10`, `unit="kg"`
2. Get user location from profile
3. Call `search_suppliers(product_query="potatoes", quantity=10, user_lat=-1.9441, user_lng=30.0619)`
4. Receive 5 results prioritized by tier and distance
5. Present recommended supplier with benefits highlighted
6. Show alternatives for transparency

### Use Case 2: Pharmacy Products
**User**: "Where can I buy paracetamol near Kimironko?"

**Agent Flow**:
1. Extract: `product_query="paracetamol"`, `category="pharmacy"`
2. Geocode "Kimironko" to get coordinates
3. Call `search_suppliers(product_query="paracetamol", category="pharmacy", user_lat=..., user_lng=...)`
4. Present pharmacies with preferred suppliers at top
5. Highlight prescription requirements if needed

### Use Case 3: Hardware Store Search
**User**: "I want to buy 5 bags of cement"

**Agent Flow**:
1. Extract: `product_query="cement"`, `quantity=5`, `unit="bag"`, `category="hardware"`
2. Call `search_suppliers(...)`
3. Calculate total price with discounts
4. Show delivery options
5. Connect user to supplier via WhatsApp or phone

## 🔐 Security & RLS Policies

### Row Level Security (RLS)

**Public Read Policies:**
- `preferred_suppliers`: Active suppliers only
- `supplier_products`: In-stock products only
- `supplier_benefits`: Active benefits within validity period
- `supplier_service_areas`: Active service areas only

**User-Specific Policies:**
- `supplier_orders`: Users can view/create their own orders

**Admin Policies:**
- Service role has full CRUD access to all tables

## 🚀 Deployment

### Database Migrations
```bash
# Apply migrations (already in /supabase/migrations/)
supabase db push

# Or deploy via CI/CD
```

**Migration Files:**
1. `20251207000000_create_preferred_suppliers.sql` - Core tables and functions
2. `20251207000001_add_search_suppliers_tool.sql` - AI agent tool integration

### Edge Functions
The `search_suppliers` tool is automatically available through the existing `tool-executor.ts` infrastructure.

**No additional deployment needed** - just push migrations and the tool executor changes.

### Admin Panel
```bash
cd admin-app
npm run build
# Deploy via your standard process
```

## 📈 Metrics & Analytics

### Track
- **Supplier Performance**:
  - Orders received
  - Average order value
  - Delivery success rate
  - Customer ratings

- **Benefits Usage**:
  - Discount redemptions
  - Free delivery triggers
  - Cashback accumulation

- **Search Analytics**:
  - Popular products
  - Geographic distribution
  - Conversion rates (search → order)

### Queries (for future dashboards)
```sql
-- Top performing suppliers
SELECT s.business_name, COUNT(o.id) as order_count, SUM(o.total_amount) as total_revenue
FROM preferred_suppliers s
LEFT JOIN supplier_orders o ON s.id = o.supplier_id
WHERE o.status = 'delivered'
GROUP BY s.id, s.business_name
ORDER BY total_revenue DESC
LIMIT 10;

-- Most searched products
SELECT product_name, COUNT(*) as search_count
FROM supplier_products
WHERE created_at > now() - interval '30 days'
GROUP BY product_name
ORDER BY search_count DESC;
```

## 🧪 Testing

### Manual Testing
```bash
# Test the RPC function directly
psql $DATABASE_URL << EOF
SELECT * FROM search_preferred_suppliers(
  'potatoes',
  -1.9441,
  30.0619,
  10,
  5
);
EOF
```

### Via Admin Panel
1. Navigate to `/suppliers`
2. Verify suppliers list loads
3. Check tier badges and counts

### Via AI Agent
1. Call the Call Center AGI
2. Say: "I want to buy 10kg of potatoes"
3. Verify it returns preferred suppliers with benefits highlighted

## 📝 Sample Data

The migration includes sample data for **Kigali Fresh Market**:
- **Tier**: Platinum
- **Products**: Potatoes, Tomatoes, Onions, Carrots
- **Benefits**: 10% discount, Free delivery over 5,000 RWF
- **Location**: Kigali, Nyarugenge (-1.9441, 30.0619)

## 🔄 Future Enhancements

### Phase 2 (Next PR)
- [ ] Supplier onboarding workflow
- [ ] Product inventory sync
- [ ] Real-time stock updates
- [ ] Automated reordering
- [ ] Supplier mobile app

### Phase 3
- [ ] Multi-currency support
- [ ] International suppliers
- [ ] B2B bulk ordering
- [ ] Supplier API integrations
- [ ] Advanced analytics dashboard

### Phase 4
- [ ] AI-powered demand forecasting
- [ ] Dynamic pricing engine
- [ ] Loyalty program automation
- [ ] Supplier performance ML scoring

## 🤝 Contributing

See the main `CONTRIBUTING.md` for guidelines. Preferred suppliers is part of the marketplace domain.

## 📞 Support

- **Slack**: #marketplace-dev
- **Issues**: Tag with `preferred-suppliers` label
- **Docs**: This file + inline code comments

## 📚 Related Documentation

- `MY_BUSINESS_README.md` - Business directory integration
- `BUY_SELL_ISSUE_RESOLVED.md` - Buy & Sell agent context
- `CALL_CENTER_AGI_SUMMARY.md` - Call Center AGI overview
- `GROUND_RULES.md` - Observability and security standards

---

**Last Updated**: 2025-12-07  
**Version**: 1.0.0  
**Status**: ✅ Ready for deployment
