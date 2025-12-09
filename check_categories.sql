SELECT category_name, COUNT(*) as count
FROM public.business
WHERE is_active = true
GROUP BY category_name
ORDER BY count DESC
LIMIT 20;
