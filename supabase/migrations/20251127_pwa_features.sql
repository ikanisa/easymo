-- ============================================
-- CLIENT PWA DATABASE SCHEMA
-- Bar & Restaurant Ordering System
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USER PREFERENCES (for recommendations)
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    phone_number TEXT,
    
    dietary_restrictions TEXT[] DEFAULT '{}',
    favorite_categories TEXT[] DEFAULT '{}',
    allergens TEXT[] DEFAULT '{}',
    
    preferred_spice_level INTEGER DEFAULT 2,
    price_preference JSONB DEFAULT '{"min": 0, "max": 100000}',
    
    language TEXT DEFAULT 'en',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE NULLS NOT DISTINCT (user_id),
    UNIQUE NULLS NOT DISTINCT (phone_number)
);

-- ============================================
-- PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    phone_number TEXT,
    
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    
    device_info JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_phone ON push_subscriptions(phone_number);

-- ============================================
-- ANALYTICS EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id TEXT,
    
    event_type TEXT NOT NULL,
    event_data JSONB,
    
    page_url TEXT,
    referrer TEXT,
    device_info JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
