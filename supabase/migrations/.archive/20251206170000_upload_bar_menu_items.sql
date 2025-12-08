-- =====================================================
-- UPLOAD BAR MENU ITEMS FROM CSV
-- Created: 2025-12-06
-- Description: Bulk upload menu items for all bars
-- =====================================================

BEGIN;

-- Insert all menu items with UPSERT logic
-- CSV columns: bar name, bar_id, item name, price, category

