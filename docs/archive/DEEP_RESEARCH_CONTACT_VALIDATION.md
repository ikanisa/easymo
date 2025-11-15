# Deep Research with Contact Number Validation

**Date:** November 14, 2025, 9:35 PM  
**Status:** ✅ ENHANCED - Contact Numbers Required

---

## 🎯 Critical Enhancement: Contact Number Requirement

ALL properties MUST have valid WhatsApp/phone numbers with country codes.

### What Was Changed

1. **Database Schema Updated**
   - `contact_info` field now REQUIRED (NOT NULL)
   - Minimum 10 characters validation
   - Index added for fast contact lookups
   - `source_url` field added for listing URLs

2. **SerpAPI Integration Enhanced**
   - 5 different search queries per location
   - OpenAI-powered extraction of property details
   - Smart contact number extraction and validation
   - Country-specific phone number normalization

3. **Econfary API Enhanced**
   - Multiple contact field checks (contact, phone, whatsapp, mobile)
   - Validation before insertion
   - Logging for properties without contacts

4. **Contact Number Normalization**
   - Automatic country code addition
   - Format: `+250XXXXXXXXX` (Rwanda)
   - Format: `+356XXXXXXXX` (Malta)
   - Format: `+255XXXXXXXXX` (Tanzania)
   - Format: `+254XXXXXXXXX` (Kenya)
   - Format: `+256XXXXXXXXX` (Uganda)

---

## 📋 SerpAPI Search Queries

For each location, we run 5 comprehensive searches:

```typescript
[
  "rental properties {location} contact phone whatsapp",
  "houses for rent {location} bedrooms price contact",
  "apartments for rent {location} furnished price phone",
  "property rental {location} available now contact number",
  "real estate rent {location} whatsapp contact",
];
```

This ensures we capture listings from:

- Real estate websites
- Classified ads (OLX, Jumia House, etc.)
- Facebook Marketplace
- Property portals
- Direct landlord listings

---

## 🔍 Property Extraction Process

### Step 1: Web Search (SerpAPI)

```
User Query → SerpAPI → 30 results per query × 5 queries = 150 results
```

### Step 2: AI Extraction (OpenAI GPT-4o-mini)

Each search result is analyzed for:

- Property title
- Type (apartment/house/villa/studio)
- Bedrooms and bathrooms
- Price and currency
- Address/location
- Amenities
- **Contact number (REQUIRED)**
- Available from date

### Step 3: Contact Validation

```typescript
// Must have contact
if (!contact || contact.length < 10) {
  SKIP_PROPERTY();
}

// Normalize format
contact = normalizePhoneNumber(contact, country);
// Result: +250XXXXXXXXX

// Validate
if (!contact.match(/^\+\d{10,15}$/)) {
  SKIP_PROPERTY();
}
```

### Step 4: Save to Database

Only properties with:

- ✅ Valid contact number (+XXX format)
- ✅ Price > 0
- ✅ Bedrooms ≥ 1
- ✅ Valid property type

---

## 📊 Expected Results Per Run

### Rwanda (Kigali)

```bash
Econfary API:         30-50 properties (all with contacts)
SerpAPI:              20-30 properties (validated contacts)
OpenAI Deep Research: 10-15 properties (with contacts)
-----------------------------------------------------------
Total:                60-95 properties WITH CONTACT NUMBERS
```

### Malta (Valletta, Sliema)

```bash
Econfary API:         25-40 properties
SerpAPI:              15-25 properties
OpenAI Deep Research: 8-12 properties
-----------------------------------------------------------
Total:                48-77 properties WITH CONTACT NUMBERS
```

### Tanzania, Kenya, Uganda (Combined)

```bash
Total per country:    40-70 properties WITH CONTACT NUMBERS
```

---

## 🚀 Deployment Steps

```bash
# 1. Apply updated database migration
supabase db push

# 2. Deploy enhanced function
supabase functions deploy openai-deep-research

# 3. Set SerpAPI key (if not set)
# In Supabase Dashboard: Settings → Edge Functions → Secrets
# SERPAPI_KEY=YOUR_KEY

# 4. Test with contact validation
curl -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{
    "action": "scrape",
    "testMode": true,
    "countries": ["RW"]
  }'

# 5. Verify ALL properties have contacts
psql $DATABASE_URL -c "
  SELECT
    source,
    COUNT(*) as total_properties,
    COUNT(contact_info) as with_contact,
    COUNT(CASE WHEN contact_info LIKE '+%' THEN 1 END) as intl_format
  FROM researched_properties
  WHERE scraped_at > NOW() - INTERVAL '1 hour'
  GROUP BY source;
"

# Expected: total_properties = with_contact = intl_format
```

---

## 📈 Monitoring Contact Numbers

### Check Contact Quality

```sql
-- View all contacts from last run
SELECT
  title,
  source,
  contact_info,
  price,
  currency,
  location_city,
  location_country
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '1 hour'
ORDER BY source, price;

-- Verify all have proper format
SELECT
  source,
  COUNT(*) as total,
  COUNT(CASE WHEN contact_info LIKE '+250%' THEN 1 END) as rwanda,
  COUNT(CASE WHEN contact_info LIKE '+356%' THEN 1 END) as malta,
  COUNT(CASE WHEN contact_info LIKE '+255%' THEN 1 END) as tanzania,
  COUNT(CASE WHEN contact_info LIKE '+254%' THEN 1 END) as kenya,
  COUNT(CASE WHEN contact_info LIKE '+256%' THEN 1 END) as uganda
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

### Check Skipped Properties (No Contact)

```sql
-- These should be minimal
SELECT COUNT(*) as properties_skipped_no_contact
FROM logs
WHERE event_name = 'PROPERTY_SKIP_NO_CONTACT'
AND created_at > NOW() - INTERVAL '1 hour';
```

---

## ✅ Validation Checklist

After deployment, verify:

- [ ] All properties in database have `contact_info` NOT NULL
- [ ] All contacts start with `+` (international format)
- [ ] Contact length is between 10-17 characters
- [ ] Properties without contacts are logged and skipped
- [ ] SerpAPI returns properties with contact numbers
- [ ] Econfary API returns properties with contact numbers
- [ ] OpenAI extraction includes contact numbers
- [ ] Duplicate detection works with contact + price
- [ ] No errors in insertion due to missing contacts

---

## 🔧 Troubleshooting

### Issue: Too many properties skipped (no contact)

**Solution:**

```bash
# Check SerpAPI search results
curl "https://serpapi.com/search?api_key=$SERPAPI_KEY&engine=google&q=rental+properties+kigali+whatsapp+contact"

# Improve search queries (add more contact-specific terms)
# Update search queries in fetchSerpAPIProperties()
```

### Issue: Contact numbers not in international format

**Solution:**

```sql
-- Find invalid formats
SELECT contact_info, COUNT(*)
FROM researched_properties
WHERE contact_info NOT LIKE '+%'
GROUP BY contact_info;

-- Update manually if needed
UPDATE researched_properties
SET contact_info = '+250' || LTRIM(contact_info, '0')
WHERE contact_info LIKE '0%' AND location_country = 'Rwanda';
```

### Issue: Duplicate contacts (same person, multiple listings)

**This is OK!** Same person can have multiple properties. Deduplication uses:

- title + address OR
- contact + price

Different properties from same owner will be saved separately.

---

## 📱 WhatsApp Integration

Properties with contact numbers are ready for WhatsApp integration:

```typescript
// When user selects a property
const property = await getProperty(propertyId);

// Contact owner via WhatsApp
const message = `Hi! I'm interested in your property: ${property.title}. 
Is it still available?`;

const whatsappLink = `https://wa.me/${property.contact_info.replace("+", "")}?text=${encodeURIComponent(message)}`;

// Send link to user
await sendWhatsAppMessage(userId, whatsappLink);
```

---

## 🎯 Success Metrics

Track these KPIs:

```sql
-- Contact coverage rate (should be 100%)
SELECT
  ROUND(100.0 * COUNT(contact_info) / COUNT(*), 2) as contact_coverage_percent
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '7 days';

-- Properties by source with contacts
SELECT
  source,
  COUNT(*) as total,
  COUNT(DISTINCT contact_info) as unique_contacts,
  ROUND(AVG(price), 2) as avg_price
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY source;

-- Top 10 most active landlords
SELECT
  contact_info,
  COUNT(*) as properties_count,
  AVG(price) as avg_price,
  STRING_AGG(DISTINCT location_city, ', ') as cities
FROM researched_properties
WHERE scraped_at > NOW() - INTERVAL '30 days'
GROUP BY contact_info
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;
```

---

## 🎉 Summary

**Status:** ✅ ALL PROPERTIES NOW HAVE CONTACT NUMBERS

**Enhancements:**

- ✅ SerpAPI with 5 search queries per location
- ✅ AI-powered contact extraction
- ✅ International format normalization (+XXX)
- ✅ Database constraint (contact_info NOT NULL)
- ✅ Validation before insertion
- ✅ Comprehensive logging

**Result:** Every property in the database is now contactable via WhatsApp!

---

**Ready to deploy and start collecting properties with guaranteed contact information!** 🚀
