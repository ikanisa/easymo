-- Migration: Insurance Dynamic Country Configuration
-- Date: 2025-11-25
-- Purpose: Move hardcoded country list to app_config table for dynamic management

BEGIN;

-- Insert insurance country configuration
INSERT INTO public.app_config (key, value, description, updated_at)
VALUES 
    (
        'insurance.allowed_countries',
        '["RW"]'::jsonb,
        'List of ISO country codes where motor insurance feature is enabled',
        now()
    )
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- Add OCR timeout configuration
INSERT INTO public.app_config (key, value, description, updated_at)
VALUES 
    (
        'insurance.ocr_timeout_ms',
        '30000'::jsonb,
        'Timeout in milliseconds for OCR API calls',
        now()
    )
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- Add max OCR retries configuration
INSERT INTO public.app_config (key, value, description, updated_at)
VALUES 
    (
        'insurance.ocr_max_retries',
        '2'::jsonb,
        'Maximum number of retry attempts for failed OCR calls',
        now()
    )
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- Add token bonus amount configuration
INSERT INTO public.app_config (key, value, description, updated_at)
VALUES 
    (
        'insurance.token_bonus_amount',
        '2000'::jsonb,
        'Number of tokens awarded for insurance document submission',
        now()
    )
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

COMMIT;
