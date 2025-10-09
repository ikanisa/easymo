-- Data-quality smoke checks consumed by dashboards / alerts
SELECT 'notifications_stuck' AS check_name, count(*) AS total
FROM public.notifications
WHERE status = 'queued'
  AND created_at < timezone('utc', now()) - interval '2 hours';

SELECT 'menus_without_items' AS check_name, count(*) AS total
FROM public.menus m
LEFT JOIN public.items i ON i.menu_id = m.id
WHERE m.status = 'published'
GROUP BY m.id
HAVING count(i.id) = 0;
