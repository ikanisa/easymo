-- Get total counts
SELECT 
  'Total businesses' as metric,
  COUNT(*) as count
FROM public.business
UNION ALL
SELECT 
  'Active businesses' as metric,
  COUNT(*) as count
FROM public.business
WHERE is_active = true
UNION ALL
SELECT 
  'With category_id' as metric,
  COUNT(*) as count
FROM public.business
WHERE category_id IS NOT NULL;

-- Show distribution of category_id values
SELECT 
  category_id,
  COUNT(*) as count
FROM public.business
WHERE category_id IS NOT NULL
GROUP BY category_id
ORDER BY count DESC
LIMIT 20;
