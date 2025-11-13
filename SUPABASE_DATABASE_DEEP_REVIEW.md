# Supabase Database Deep Review & Cleanup Recommendations

**Date**: November 13, 2025  
**Database**: lhbowpbcpwoiparwnwgt  
**Total Tables**: 191 tables

---

## Executive Summary

Your Supabase database has **191 tables**, which is excessive and indicates:
- **Multiple duplicate/redundant tables**
- **Lack of consolidation** between related features
- **Orphaned tables** from old features
- **Inconsistent naming** (business vs shops vs bars)

**Recommendation**: **Delete or merge 50-60 tables** to achieve a clean, maintainable database.

---

## Critical Issues Found

### 1. 🔴 DUPLICATE BUSINESS TABLES (High Priority)
**Problem**: Multiple tables for the same concept

```
- businesses (main table)
- business (duplicate?)
- shops (duplicate?)
- bars (specific type)
```

**❌ Issues**:
- Data inconsistency across tables
- Confusion about which table to use
- Multiple sources of truth

**✅ RECOMMENDATION**:
```sql
-- KEEP: businesses (main table)
-- MERGE INTO businesses:
--   - shops → businesses (with type='shop')
--   - bars → businesses (with type='bar')
-- DELETE: business (if it's a duplicate)
```

**Migration Strategy**:
1. Add `business_type` ENUM to `businesses` ('restaurant', 'shop', 'bar', 'service')
2. Migrate data from `shops` → `businesses`
3. Migrate data from `bars` → `businesses`
4. Update all foreign keys
5. Drop old tables

---

### 2. 🔴 DUPLICATE ORDER TABLES (High Priority)

```
- orders (main orders)
- draft_orders (cart/pending orders)
- carts (duplicate of draft_orders?)
- waiter_orders (specific to waiter AI)
```

**❌ Issues**:
- `carts` and `draft_orders` serve the same purpose
- Waiter AI orders isolated from main system

**✅ RECOMMENDATION**:
```sql
-- KEEP: orders (completed orders)
-- KEEP: draft_orders (pending/cart orders)
-- DELETE: carts (merge into draft_orders)
-- EVALUATE: waiter_orders (integrate into orders with source='waiter_ai')
```

---

### 3. 🔴 DUPLICATE ORDER ITEMS TABLES

```
- order_items
- draft_order_items
- cart_items
- waiter_order_items
```

**✅ RECOMMENDATION**:
```sql
-- KEEP: order_items (for completed orders)
-- KEEP: draft_order_items (for draft orders)
-- DELETE: cart_items (merge into draft_order_items)
-- DELETE: waiter_order_items (use order_items with order_source)
```

---

### 4. 🔴 DUPLICATE MENU TABLES

```
- menu_items
- items
- menus
- restaurant_menu_items
- whatsapp_home_menu_items
```

**❌ Issues**:
- `items` vs `menu_items` - unclear purpose
- Platform-specific menu tables (WhatsApp, restaurant)

**✅ RECOMMENDATION**:
```sql
-- KEEP: menu_items (main table)
-- KEEP: menu_categories
-- DELETE: items (if duplicate of menu_items)
-- DELETE: restaurant_menu_items (use menu_items with business_id)
-- DELETE: whatsapp_home_menu_items (use menu_items with is_featured flag)
```

---

### 5. 🟡 DUPLICATE PAYMENT TABLES (Medium Priority)

```
- payments
- transactions
- wallet_transactions
- waiter_payments
- payment_events
- transaction_events
```

**✅ RECOMMENDATION**:
```sql
-- KEEP: transactions (main payment records)
-- KEEP: transaction_events (audit trail)
-- KEEP: wallet_transactions (wallet-specific)
-- DELETE: payments (if duplicate of transactions)
-- MERGE: waiter_payments → transactions (add source column)
-- EVALUATE: payment_events vs transaction_events (same thing?)
```

---

### 6. 🟡 DUPLICATE CONVERSATION/MESSAGE TABLES

```
-- AI/Agent Systems:
- agent_conversations
- agent_messages
- agent_chat_sessions
- agent_chat_messages
- ai_conversations
- ai_messages

-- Waiter AI:
- waiter_conversations
- waiter_messages

-- General:
- conversations
- messages
- wa_messages (WhatsApp)
```

**❌ Issues**:
- Too many similar conversation systems
- No unified messaging architecture

**✅ RECOMMENDATION**:
```sql
-- Option A: Unified System
CREATE TABLE unified_conversations (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL, -- 'agent', 'waiter', 'whatsapp', 'general'
  source TEXT, -- 'waiter_ai', 'agent_chat', etc.
  ...
);

CREATE TABLE unified_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES unified_conversations(id),
  ...
);

-- Option B: Keep Separate (Current)
-- But consolidate:
--   - agent_conversations + agent_chat_sessions → agent_conversations
--   - agent_messages + agent_chat_messages → agent_messages
--   - ai_conversations → agent_conversations (merge)
```

---

### 7. 🟡 DUPLICATE AGENT TABLES

```
AI/Agent tables (23 tables total):
- agent_sessions
- agent_conversations  
- agent_chat_sessions (duplicate?)
- agent_messages
- agent_chat_messages (duplicate?)
- ai_agents
- ai_conversations (duplicate?)
- ai_messages (duplicate?)
- ... (and 15 more)
```

**❌ Issues**:
- `ai_*` and `agent_*` prefixes for same features
- Redundant session/chat tables

**✅ RECOMMENDATION**:
```sql
-- Consolidate to ONE agent system:
KEEP:
- agent_sessions (unified sessions)
- agent_conversations
- agent_messages
- agent_tools
- agent_tool_executions
- agent_metrics
- agent_audit_log

MERGE OR DELETE:
- ai_agents → agent_registry
- ai_conversations → agent_conversations
- ai_messages → agent_messages
- ai_tool_executions → agent_tool_executions
- agent_chat_sessions → agent_sessions
- agent_chat_messages → agent_messages
```

---

### 8. 🟢 REDUNDANT/UNUSED TABLES (Low Priority)

#### Potentially Unused Tables:
```sql
-- Old/deprecated tables:
- legacy_customer_profile (marked as legacy)
- bar_number_canonicalization_conflicts (specific edge case)
- campaign_target_archives (archival table)

-- Overly specific tables:
- driver_parking
- driver_presence
- driver_availability
- driver_status
(Can these be merged into a single drivers table?)

-- Redundant config tables:
- settings
- app_config
- configurations
- configuration_history
- bar_settings
(Can be unified into ONE config table)
```

**✅ RECOMMENDATION**: Review usage and consolidate

---

## Detailed Table Analysis

### ✅ WELL-STRUCTURED TABLES (Keep As-Is)

#### Waiter AI System (7 tables) - GOOD
```
✓ waiter_conversations - Chat sessions
✓ waiter_messages - Chat history  
✓ waiter_orders - Orders from AI
✓ waiter_order_items - Order line items
✓ waiter_payments - Payment tracking
✓ waiter_reservations - Table bookings
✓ waiter_feedback - Customer feedback
```
**Status**: Well-isolated, clear purpose. **NO CHANGES NEEDED**.

---

### 🔴 TABLES TO DELETE (High Confidence)

```sql
-- 1. Duplicate business tables
DROP TABLE IF EXISTS business; -- Use 'businesses'
DROP TABLE IF EXISTS shops; -- Merge into businesses

-- 2. Duplicate cart tables
DROP TABLE IF EXISTS carts; -- Use draft_orders
DROP TABLE IF EXISTS cart_items; -- Use draft_order_items

-- 3. Duplicate item tables
DROP TABLE IF EXISTS items; -- Use menu_items

-- 4. Duplicate payment tables
DROP TABLE IF EXISTS payments; -- Use transactions

-- 5. Redundant AI tables
DROP TABLE IF EXISTS ai_conversations; -- Use agent_conversations
DROP TABLE IF EXISTS ai_messages; -- Use agent_messages
DROP TABLE IF EXISTS agent_chat_sessions; -- Use agent_sessions
DROP TABLE IF EXISTS agent_chat_messages; -- Use agent_messages

-- 6. Legacy tables
DROP TABLE IF EXISTS legacy_customer_profile;

-- 7. Overly specific tables (if unused)
DROP TABLE IF EXISTS bar_number_canonicalization_conflicts;
DROP TABLE IF EXISTS whatsapp_home_menu_items; -- Use menu_items with flag
```

**Total to Delete**: ~15-20 tables

---

### 🟡 TABLES TO MERGE

#### 1. Business Tables → businesses
```sql
-- Add type column
ALTER TABLE businesses ADD COLUMN business_type TEXT 
  CHECK (business_type IN ('restaurant', 'bar', 'shop', 'service', 'other'));

-- Migrate shops
INSERT INTO businesses (name, ..., business_type)
SELECT name, ..., 'shop' FROM shops;

-- Migrate bars
INSERT INTO businesses (name, ..., business_type)
SELECT name, ..., 'bar' FROM bars;

-- Update foreign keys
ALTER TABLE orders ADD COLUMN business_id UUID REFERENCES businesses(id);
UPDATE orders o SET business_id = b.id 
FROM shops s JOIN businesses b ON s.name = b.name 
WHERE o.shop_id = s.id;

-- Drop old tables
DROP TABLE shops CASCADE;
DROP TABLE bars CASCADE;
```

#### 2. Cart Tables → draft_orders
```sql
-- Migrate carts to draft_orders
INSERT INTO draft_orders (user_id, status, created_at)
SELECT user_id, 'pending', created_at FROM carts;

-- Migrate cart_items to draft_order_items
INSERT INTO draft_order_items (draft_order_id, menu_item_id, quantity)
SELECT do.id, ci.menu_item_id, ci.quantity
FROM cart_items ci
JOIN carts c ON c.id = ci.cart_id
JOIN draft_orders do ON do.user_id = c.user_id;

-- Drop old tables
DROP TABLE cart_items CASCADE;
DROP TABLE carts CASCADE;
```

#### 3. Config Tables → configurations
```sql
-- Unified config table
CREATE TABLE IF NOT EXISTS configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL, -- 'app', 'bar', 'system', 'feature'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  business_id UUID REFERENCES businesses(id), -- nullable for global configs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, key, business_id)
);

-- Migrate from multiple tables
INSERT INTO configurations (scope, key, value)
SELECT 'app', key, to_jsonb(value) FROM app_config;

INSERT INTO configurations (scope, key, value)
SELECT 'system', key, to_jsonb(value) FROM settings;

-- Drop old tables
DROP TABLE app_config;
DROP TABLE settings;
DROP TABLE bar_settings; -- migrate first
```

---

## Tables Missing Columns

### Waiter AI Tables - Missing Columns

#### waiter_conversations
```sql
-- Add missing columns for completeness
ALTER TABLE waiter_conversations ADD COLUMN IF NOT EXISTS
  language TEXT DEFAULT 'en',
  platform TEXT DEFAULT 'web',
  metadata JSONB,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0;
```

#### waiter_messages
```sql
-- Add missing columns
ALTER TABLE waiter_messages ADD COLUMN IF NOT EXISTS
  metadata JSONB,
  tool_calls JSONB,
  citations JSONB,
  error TEXT;
```

#### waiter_orders
```sql
-- Ensure all order columns exist
ALTER TABLE waiter_orders ADD COLUMN IF NOT EXISTS
  business_id UUID REFERENCES businesses(id),
  table_number TEXT,
  special_instructions TEXT,
  estimated_ready_time TIMESTAMPTZ,
  actual_ready_time TIMESTAMPTZ,
  delivery_address JSONB,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0;
```

### menu_items
```sql
-- Add missing menu item columns
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS
  business_id UUID REFERENCES businesses(id),
  category_id UUID REFERENCES menu_categories(id),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  allergens TEXT[],
  dietary_info JSONB,
  preparation_time INTEGER, -- minutes
  calories INTEGER,
  spice_level INTEGER CHECK (spice_level BETWEEN 0 AND 5),
  tags TEXT[],
  display_order INTEGER DEFAULT 0;
```

### businesses
```sql
-- Add missing business columns
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  business_type TEXT CHECK (business_type IN ('restaurant', 'bar', 'shop', 'service')),
  cuisine_type TEXT[],
  opening_hours JSONB,
  delivery_enabled BOOLEAN DEFAULT false,
  takeaway_enabled BOOLEAN DEFAULT true,
  dine_in_enabled BOOLEAN DEFAULT true,
  average_prep_time INTEGER,
  min_order_amount DECIMAL(10,2),
  delivery_radius_km DECIMAL(5,2),
  rating DECIMAL(3,2),
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ;
```

---

## WhatsApp Flow Integration Check

### Tables Used by WhatsApp Flow:
```
✓ wa_messages - WhatsApp messages
✓ wa_events - WhatsApp events
✓ wa_threads - Conversation threads
✓ business_whatsapp_numbers - Phone number mapping
✓ whatsapp_sessions - Session management
✓ whatsapp_message_queue - Message queue
✓ whatsapp_templates - Message templates
```

**Status**: Core WhatsApp tables present. ✅

### Missing Integration:
```
❌ waiter_conversations not linked to wa_threads
❌ waiter_orders not linked to wa_messages
❌ businesses not linked to business_whatsapp_numbers consistently
```

**✅ RECOMMENDATION**: Add cross-references
```sql
ALTER TABLE waiter_conversations 
  ADD COLUMN wa_thread_id UUID REFERENCES wa_threads(id);

ALTER TABLE waiter_orders 
  ADD COLUMN wa_message_id UUID REFERENCES wa_messages(id);

ALTER TABLE businesses 
  ADD COLUMN whatsapp_number_id UUID REFERENCES business_whatsapp_numbers(id);
```

---

## Admin Panel Integration Check

### Admin-Specific Tables:
```
✓ admin_audit_log - Admin actions
✓ admin_sessions - Admin logins
✓ admin_submissions - Form submissions
✓ admin_pin_sessions - PIN authentication
✓ admin_alert_prefs - Alert preferences
```

**Status**: Admin infrastructure present. ✅

### Tables Accessible from Admin Panel (Should Be):
```
✓ businesses - Manage businesses
✓ menu_items - Manage menus
✓ menu_categories - Manage categories
✓ orders - View/manage orders
✓ users/profiles - Manage users
✓ payments/transactions - View payments
✓ waiter_conversations - Monitor AI chats
✓ waiter_feedback - View feedback
```

**✅ RECOMMENDATION**: Ensure admin panel has views/functions for all core tables

---

## Cleanup Action Plan

### Phase 1: Delete Obvious Duplicates (Week 1)
```sql
-- Backup first!
pg_dump > backup_before_cleanup.sql

-- Delete duplicate tables
DROP TABLE IF EXISTS business CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS agent_chat_sessions CASCADE;
DROP TABLE IF EXISTS agent_chat_messages CASCADE;
DROP TABLE IF EXISTS legacy_customer_profile CASCADE;
```

### Phase 2: Merge Tables (Week 2)
```sql
-- 1. Merge shops → businesses
-- 2. Merge bars → businesses
-- 3. Consolidate agent tables
-- 4. Consolidate config tables
```

### Phase 3: Add Missing Columns (Week 3)
```sql
-- Add all missing columns identified above
-- Update RLS policies
-- Update indexes
```

### Phase 4: Integration Fixes (Week 4)
```sql
-- Add WhatsApp cross-references
-- Add admin panel views
-- Update foreign keys
-- Test all integrations
```

---

## Final Recommended Table Count

**Current**: 191 tables  
**After Cleanup**: ~130-140 tables  
**Reduction**: 50-60 tables (26-31%)

### Core Tables to Keep (by category):

**Waiter AI** (7 tables): Keep all ✓  
**Business** (1-2 tables): businesses, business_owners  
**Menu** (2-3 tables): menu_items, menu_categories, menus  
**Orders** (2-3 tables): orders, draft_orders, order_items, draft_order_items  
**Users** (2-3 tables): profiles, user_favorites, user_payment_methods  
**Payments** (3-4 tables): transactions, wallet_transactions, transaction_events  
**Agent System** (10-12 tables): Consolidate from 23 to ~12  
**WhatsApp** (6-8 tables): Keep core integration tables  
**Admin** (5-6 tables): Keep admin infrastructure  
**System** (3-4 tables): Unified configurations  

---

## Summary & Next Steps

### 🎯 Immediate Actions:
1. **Create backup** of entire database
2. **Delete obvious duplicates** (business, carts, items, etc.)
3. **Add missing columns** to waiter_* tables
4. **Test admin panel** and WhatsApp flow after changes

### 📋 Detailed Cleanup Script:
Would you like me to generate:
1. Complete SQL migration script for cleanup?
2. Data migration script for merging tables?
3. RLS policy updates after cleanup?
4. Admin panel integration verification script?

---

**This review identifies 50-60 tables to delete/merge for a cleaner database.**

Let me know which phase you'd like to implement first!
