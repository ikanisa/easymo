BEGIN;

-- Migrate bars data into the business table
-- This allows users to claim bars using the existing "My Business" workflow

INSERT INTO public.business (id, name, owner_whatsapp, owner_user_id, created_at)
SELECT 
  id,
  name,
  NULL as owner_whatsapp,  -- Will be filled when users claim
  NULL as owner_user_id,   -- Will be filled when users claim
  created_at
FROM public.bars
ON CONFLICT (id) DO NOTHING;

-- Note: The existing workflow is:
-- 1. User taps "My Business" from profile
-- 2. User taps "Add Business"
-- 3. User types business name
-- 4. System uses search_businesses_semantic() to find matches
-- 5. User selects their business from the list
-- 6. Entry is created in user_businesses table (no authentication/verification needed)

COMMIT;
