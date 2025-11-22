# Business Directory Data Sources & User Contributions

**Last Updated**: 2025-11-22  
**Status**: Active System

## Overview

The easyMO Business Directory (`business_directory` table) aggregates data from **multiple sources** to provide comprehensive business, property, and job listings across Rwanda.

## 📊 Data Sources

### 1. **Web Scraped Data** (Primary)
- **Source**: Google Maps, Yellow Pages, online directories
- **Volume**: 8,000+ businesses initially imported
- **Method**: Automated scraping tools
- **Quality**: Verified business information with ratings, reviews
- **Edge Function**: `ingest-businesses`
- **Categories**: Restaurants, pharmacies, shops, services, etc.

### 2. **User-Added Listings** (User-Generated Content)
Users can add listings through WhatsApp AI agents in **three categories**:

#### A. **Business Listings**
- **Agent**: Business Broker AI Agent
- **Method**: Direct business creation
- **Fields**: Business name, category, location, contact, services
- **Auto-enrollment**: ✅ Automatically added to business directory
- **Use Case**: Local shops, service providers, freelancers

#### B. **Product/Service Listings**
- **Agent**: Business Broker AI Agent, Farmer Agent
- **Method**: List individual products or services
- **Behavior**: 
  - If user lists a **product** → Creates business entry + product listing
  - If user lists a **service** → Creates business entry + service offering
  - User is **automatically enrolled** in business directory as a vendor
- **Use Case**: Individual sellers, artisans, consultants, farmers

#### C. **Property Listings**
- **Agent**: Property Rental Agent
- **Method**: Add rental properties (apartments, houses, commercial)
- **Fields**: Property type, location, price, amenities, photos
- **Integration**: Properties searchable via Business Directory
- **Use Case**: Landlords, property managers, real estate agents

#### D. **Job Postings**
- **Agent**: Jobs & Gigs Agent
- **Method**: Post job opportunities or gig requests
- **Fields**: Job title, description, location, compensation, requirements
- **Integration**: Jobs searchable via Business Directory
- **Use Case**: Employers, freelancers offering services

## 🔄 Automatic Business Directory Enrollment

### When Does It Happen?

**Trigger Event**: User lists a product OR service through any AI agent

**Automatic Actions**:
1. ✅ Create business profile in `business_directory` table
2. ✅ Set `source = 'user_generated'`
3. ✅ Extract business info from user's WhatsApp profile/listing
4. ✅ Link user's phone number as contact
5. ✅ Assign appropriate category based on listing
6. ✅ Enable business to appear in search results

### Example Flow

```
User: "I want to sell my handmade baskets"
Agent: Business Broker AI
Action:
  1. Create product listing → baskets
  2. Create business entry:
     - Name: "User's Handmade Baskets" (from user profile)
     - Category: "Handicrafts & Artisan"
     - Phone: +250788123456 (user's WhatsApp)
     - City: "Kigali" (from user location)
     - Source: "user_generated"
     - Status: "ACTIVE"
  3. User now appears in business search results
```

## 🏗️ Database Schema

### Business Directory Table
```sql
CREATE TABLE business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Information
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  
  -- Location
  city TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  
  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Metadata
  source TEXT NOT NULL, -- 'google_maps' | 'user_generated' | 'manual'
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE' | 'INACTIVE' | 'PENDING'
  
  -- Quality Metrics
  rating NUMERIC,
  review_count INTEGER DEFAULT 0,
  
  -- User-Generated Specific
  user_id UUID, -- For user-generated listings
  verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🤖 AI Agents Integration

### Business Broker AI Agent
**File**: `supabase/functions/wa-webhook/domains/ai-agents/business_broker_agent.ts`

**Capabilities**:
- Search existing businesses
- Add new business listings
- **List products/services** (triggers auto-enrollment)
- Update business information
- Claim existing businesses

**Tools**:
- `search_businesses`: Find businesses
- `add_business`: Create new business entry
- `list_product`: List product + auto-create business
- `list_service`: List service + auto-create business

### Property Rental Agent
**Capabilities**:
- List rental properties
- Search available properties
- Properties appear in business directory under "Real Estate"

### Jobs & Gigs Agent
**Capabilities**:
- Post job opportunities
- Find job seekers
- Jobs appear in business directory under "Employment Services"

### Farmer Agent
**Capabilities**:
- List agricultural products
- Find farm equipment
- Produce listings appear in business directory under "Agriculture"

## 🔍 Search & Discovery

### How Users Find Listings

**1. Category Search**
```
User: "Find pharmacies in Kigali"
→ Searches business_directory WHERE category = 'Pharmacy' AND city = 'Kigali'
→ Returns both web-scraped AND user-generated pharmacies
```

**2. Product/Service Search**
```
User: "Who sells handmade baskets?"
→ Searches business_directory + product listings
→ Returns businesses with matching products
```

**3. Nearby Search**
```
User: "Businesses near me"
→ Uses lat/lng geospatial search
→ Returns all businesses within radius (web + user-generated)
```

## 📈 Data Quality & Verification

### Web-Scraped Data
- ✅ Pre-verified from Google Maps
- ✅ Includes ratings and reviews
- ✅ Higher trust score initially

### User-Generated Data
- ⚠️ Starts as `verified = false`
- ✅ Can be verified by:
  - Admin review
  - User verification process
  - Customer reviews/ratings
- 🔄 Status tracking: NEW → CONTACTED → QUALIFIED → VERIFIED

## 🛠️ Implementation Files

### Key Files
```
supabase/
├── functions/
│   ├── wa-webhook/domains/ai-agents/
│   │   ├── business_broker_agent.ts    # Main business agent
│   │   ├── farmer_agent.ts             # Agriculture listings
│   │   └── general_broker.ts           # Unified broker
│   ├── ingest-businesses/              # Web scraping import
│   ├── classify-business-tags/         # Auto-categorization
│   └── business-lookup/                # Search API
│
└── migrations/
    └── 20251121153900_create_business_directory.sql
```

### Admin Panel
```
admin-app/
├── app/(panel)/
│   ├── marketplace/                    # Business directory UI
│   ├── jobs/                          # Job listings management
│   └── property-rentals/              # Property listings
```

## 🔐 Security & Privacy

### User Data Protection
- ✅ Phone numbers masked in public search
- ✅ Email only visible to verified buyers
- ✅ Location approximate (city-level) unless specified
- ✅ RLS policies enforce data access control

### Spam Prevention
- Rate limiting on listing creation
- Admin review queue for suspicious listings
- Automated duplicate detection
- User reputation scoring

## 📊 Analytics & Metrics

### Tracking
- Total businesses: Web-scraped vs. User-generated
- Listing quality scores
- Search popularity by category
- Conversion rates (views → contacts)
- User engagement per listing

### Dashboard Metrics
Available in Admin Panel → Marketplace:
- New listings (last 24h, 7d, 30d)
- Top categories
- Geographic distribution
- User-generated vs. scraped ratio
- Verification status breakdown

## 🚀 Future Enhancements

### Planned Features
1. **Listing Boosting**: Paid promotion for user listings
2. **Verified Badges**: Visual trust indicators
3. **Multi-language**: Kinyarwanda, French, English descriptions
4. **Photo Upload**: Image support for user listings
5. **Review System**: Customer ratings for user-generated businesses
6. **Claiming Flow**: Existing businesses can be claimed by owners

## 📞 Contact & Support

For questions about:
- **Business listings**: Business Broker AI Agent (WhatsApp)
- **Technical issues**: Admin Panel → Support
- **Data quality**: Report via Admin Panel → Marketplace

---

**Note**: This document reflects the current implementation. User-added listings are automatically integrated into the business directory, ensuring a comprehensive and dynamic marketplace for all users.
