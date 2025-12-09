-- Check actual business table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'business'
ORDER BY ordinal_position;

-- Check sample data
SELECT id, name, category_id, tags
FROM public.business
WHERE is_active = true
LIMIT 5;
