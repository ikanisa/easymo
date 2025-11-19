-- Supply-chain ops monitoring queries
-- 1. Daily pickup metrics snapshot sourced from ops_pickup_metrics view
SELECT
    bucket_day,
    pickups,
    ROUND(avg_fill_rate * 100, 2) AS fill_rate_pct,
    ROUND(avg_spoilage_percent, 2) AS spoilage_pct,
    ROUND(deposit_success_rate * 100, 2) AS deposit_success_pct,
    ROUND(pickup_utilization_rate * 100, 2) AS pickup_utilization_pct
FROM public.ops_pickup_metrics
WHERE bucket_day >= NOW() - INTERVAL '14 days'
ORDER BY bucket_day DESC;

-- 2. Spoilage vs. committed quantity so ops can find farms that need intervention
SELECT
    f.name AS farm_name,
    s.status,
    s.pickup_scheduled_at,
    s.quantity_committed,
    s.quantity_collected,
    s.spoilage_qty,
    s.spoilage_percent
FROM public.shipments s
JOIN public.farms f ON f.id = s.farm_id
WHERE s.spoilage_percent IS NOT NULL
ORDER BY s.pickup_scheduled_at DESC
LIMIT 50;

-- 3. Deposit success by farm owner to monitor cash compliance
SELECT
    f.owner_profile_id,
    COUNT(*) FILTER (WHERE s.deposit_success IS TRUE) AS deposits_ok,
    COUNT(*) FILTER (WHERE s.deposit_success IS NOT TRUE) AS deposits_failed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE s.deposit_success IS TRUE) / NULLIF(COUNT(*), 0), 2) AS deposit_success_pct
FROM public.shipments s
JOIN public.farms f ON f.id = s.farm_id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY f.owner_profile_id
ORDER BY deposit_success_pct ASC NULLS LAST
LIMIT 25;

-- 4. Pickup utilization heatmap (scheduled vs fulfilled)
SELECT
    DATE_TRUNC('week', COALESCE(s.pickup_scheduled_at, s.created_at)) AS week,
    s.status,
    COUNT(*) AS shipments
FROM public.shipments s
WHERE s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY week, s.status
ORDER BY week DESC, s.status;
