# Real Estate AI Agent Implementation Status

**Generated:** 2025-11-13

This document provides a comprehensive overview of what already exists and what needs to be
implemented for the Real Estate AI Agent feature.

## Phase 0: Discovery - What Already Exists

### ✅ Database Schema (90% Complete)

**Existing Tables:**

- ✅ `properties` - Full table with location (PostGIS), rental_type, bedrooms, bathrooms, price,
  amenities, images, status
- ✅ `property_inquiries` - Links users to properties they're interested in
- ✅ `property_reviews` - Rating system for properties
- ✅ `agent_sessions` - Tracks all agent interactions (includes property_rental type)
- ✅ `agent_quotes` - Stores quotes/offers from vendors (including properties)
- ✅ `agent_conversations` - Message history for agent sessions
- ✅ `agent_metrics` - Analytics for agent performance

**Existing Functions:**

- ✅ `search_nearby_properties()` - PostGIS-based search with filters
- ✅ RLS policies for security
- ✅ Proper indexes for performance

**Missing Tables (Need to Add):**

- ❌ `listings` - Enhanced version with more fields (external_ref, source, owner outreach tracking)
- ❌ `property_requests` - Structured user property requests with preferences
- ❌ `shortlists` - Top-5 curated property lists with AI rationale
- ❌ `owner_outreach` - Track WhatsApp/Voice/SMS communication with property owners
- ❌ Enhanced analytics for property-specific metrics

### ✅ WhatsApp Integration (80% Complete)

**Existing Files:**

- ✅ `supabase/functions/wa-webhook/domains/property/rentals.ts` - Full property rental flow
- ✅ `supabase/functions/wa-webhook/domains/ai-agents/handlers.ts` - AI property rental handler
- ✅ `supabase/functions/wa-webhook/domains/ai-agents/integration.ts` - Agent routing
- ✅ Router integration (text, location, button handlers)
- ✅ i18n support for property rental flows
- ✅ State management for multi-step property flows

**Existing Features:**

- ✅ Property Find flow (rental type → bedrooms → budget → location → AI agent)
- ✅ Property Add flow (rental type → bedrooms → price → location → save)
- ✅ Location picker with saved favorites
- ✅ Currency support
- ✅ Short-term and long-term rental types
- ✅ AI agent integration via `handleAIPropertyRental()`

**Missing:**

- ❌ Shortlist delivery to WhatsApp users
- ❌ Owner outreach via WhatsApp templates
- ❌ Follow-up notification system
- ❌ Deep link generation for PWA

### ✅ Edge Functions (60% Complete)

**Existing:**

- ✅ `supabase/functions/agents/property-rental/index.ts` - Basic property search agent
  - Handles find and add property actions
  - Creates agent sessions
  - Searches nearby properties
  - Basic negotiation simulation
  - Quote generation

**Missing Edge Function Tools:**

- ❌ `tool-search_supabase` - Generic Supabase query tool
- ❌ `tool-deep_search_market` - External market scraping (Airbnb, Booking.com)
- ❌ `tool-contact_owner_whatsapp` - WhatsApp template messaging
- ❌ `tool-contact_owner_call` - Voice call initiation
- ❌ `tool-shortlist_rank` - AI-powered ranking with explanations
- ❌ `tool-ocr_extract` - Document/image text extraction
- ❌ `tool-notify_user` - Multi-channel notification
- ❌ `tool-persist_memory` - User preference storage

### ✅ Admin Panel (70% Complete)

**Existing:**

- ✅ `admin-app/app/(panel)/property-rentals/` - Property rentals page
- ✅ `admin-app/components/property/PropertyRentalsPanel.tsx` - Main panel component
- ✅ Uses existing marketplace components:
  - `MarketplaceRequestWizard` - Launch property searches
  - `MarketplaceQuoteComparison` - View property offers
  - `MarketplaceThreadViewer` - View WhatsApp conversations
- ✅ Real-time data polling
- ✅ Integration with agent_sessions and agent_quotes

**Missing:**

- ❌ Dashboard widget for property metrics
- ❌ Shortlists management view
- ❌ Listings CRUD interface
- ❌ Owner outreach monitoring (Kanban/table view)
- ❌ Prompts/Templates admin utility
- ❌ Analytics visualizations

### ❌ PWA Frontend (0% Complete - Major Gap)

**Missing Entirely:**

- ❌ Real estate PWA app (separate from waiter-pwa)
- ❌ Chat interface for property conversations
- ❌ Shortlist viewing UI
- ❌ Property card components
- ❌ Anonymous auth flow
- ❌ Service Worker for offline support
- ❌ PWA manifest
- ❌ Deep link handling from WhatsApp

**Existing Reference:**

- ✅ `waiter-pwa/` - Can be used as template/reference
  - Has chat components
  - Has PWA setup
  - Has offline support
  - Has i18n

### ✅ OpenAI Agent Configuration (50% Complete)

**Existing:**

- ✅ Agent type `property_rental` registered in system
- ✅ Basic routing to property rental agent
- ✅ Session management
- ✅ Quote generation

**Missing:**

- ❌ Comprehensive system prompt with guardrails
- ❌ Tool definitions for all required tools
- ❌ Multi-language prompt templates
- ❌ Persona switching (user-facing vs owner-facing)
- ❌ Memory injection hooks
- ❌ Feature flag configuration

### ✅ i18n (60% Complete)

**Existing:**

- ✅ Property rental i18n keys in WhatsApp flows
- ✅ Multi-language support infrastructure
- ✅ EN/FR support in waiter-pwa

**Missing:**

- ❌ Complete translations for EN/FR/ES/DE/PT
- ❌ PWA i18n resource files
- ❌ Admin panel property-specific translations
- ❌ WhatsApp template translations

## Implementation Priority Ranking

### Critical Path (Must Have):

1. **Phase 1**: Enhanced database schema (listings, property_requests, shortlists, owner_outreach)
2. **Phase 2**: Edge function tools (especially shortlist_rank, notify_user, contact_owner_whatsapp)
3. **Phase 3**: OpenAI agent configuration with proper system prompts and tools
4. **Phase 4**: PWA frontend (chat, shortlist view, offline support)

### High Value (Should Have):

5. **Phase 5**: Admin panel enhancements (dashboard widget, shortlist management, owner outreach)
6. **Phase 6**: Full i18n coverage (all languages)

### Nice to Have (Could Have):

7. **Phase 7**: Advanced features (OCR, external market search, voice calls)

## Key Architectural Decisions

### ✅ Additive Approach

- Existing `properties` table will remain
- New `listings` table will extend capabilities
- Both can coexist during migration
- Existing flows continue to work

### ✅ Multi-Tenant Support

- RLS policies enforce org_id separation
- Existing patterns maintained

### ✅ Security

- No external URLs exposed to users (Airbnb, Booking.com)
- No payment handling in property agent
- Webhook signature verification
- Service role key protected

### ✅ Observability

- Structured logging with correlation IDs
- Event counters for metrics
- PII masking in logs
- Following `docs/GROUND_RULES.md`

## Estimated Work Breakdown

- **Phase 1 (Database)**: 2-3 migrations, ~200 lines SQL
- **Phase 2 (Edge Functions)**: 6-8 new functions, ~1500 lines TypeScript
- **Phase 3 (Agent Config)**: 1 config file, ~300 lines
- **Phase 4 (PWA)**: New app structure, ~2000 lines TypeScript/React
- **Phase 5 (Admin)**: 3-4 new components, ~800 lines
- **Phase 6 (i18n)**: 5 language files, ~500 lines JSON
- **Phase 7 (Testing)**: Integration tests, ~400 lines

**Total Estimate**: ~5000-6000 new lines of code

## Next Steps

1. Create detailed implementation plan
2. Build Phase 1 database migrations
3. Implement Edge Function tools
4. Configure OpenAI agent
5. Build PWA frontend
6. Enhance admin panel
7. Add complete i18n
8. Testing and validation
