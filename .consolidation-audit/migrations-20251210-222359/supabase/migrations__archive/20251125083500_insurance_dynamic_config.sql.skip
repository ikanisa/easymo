-- Migration: Insurance Dynamic Country Configuration
-- Date: 2025-11-25
-- Purpose: Add insurance configuration columns to app_config table

BEGIN;

-- Add insurance configuration columns to app_config table
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS insurance_allowed_countries JSONB DEFAULT '["RW"]'::jsonb;

ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS insurance_ocr_timeout_ms INTEGER DEFAULT 30000;

ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS insurance_ocr_max_retries INTEGER DEFAULT 2;

ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS insurance_token_bonus_amount INTEGER DEFAULT 2000;

-- Update the single row with default values if it exists
INSERT INTO public.app_config (id, insurance_allowed_countries, insurance_ocr_timeout_ms, insurance_ocr_max_retries, insurance_token_bonus_amount)
VALUES (1, '["RW"]'::jsonb, 30000, 2, 2000)
ON CONFLICT (id) DO UPDATE 
SET 
  insurance_allowed_countries = COALESCE(app_config.insurance_allowed_countries, '["RW"]'::jsonb),
  insurance_ocr_timeout_ms = COALESCE(app_config.insurance_ocr_timeout_ms, 30000),
  insurance_ocr_max_retries = COALESCE(app_config.insurance_ocr_max_retries, 2),
  insurance_token_bonus_amount = COALESCE(app_config.insurance_token_bonus_amount, 2000);

COMMIT;
