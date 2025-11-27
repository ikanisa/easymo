#!/bin/bash
# Quick scraping progress checker

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           SCRAPING PROGRESS CHECK                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PGPASSWORD=Pq0jyevTlfoa376P psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" << 'EOF'
\timing off
\pset border 2

SELECT 
  '📊 JOB LISTINGS' as category,
  COUNT(*) as total,
  COUNT(CASE WHEN is_external = true THEN 1 END) as external,
  COUNT(CASE WHEN contact_phone IS NOT NULL OR contact_email IS NOT NULL THEN 1 END) as with_contact,
  ROUND(100.0 * COUNT(CASE WHEN contact_phone IS NOT NULL OR contact_email IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) || '%' as contact_coverage
FROM job_listings
UNION ALL
SELECT 
  '🏠 PROPERTIES' as category,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as external,
  COUNT(*) as with_contact,
  '100%' as contact_coverage
FROM researched_properties;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Recent Jobs (Last 5):'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  LEFT(title, 40) as title,
  LEFT(company_name, 30) as company,
  CASE 
    WHEN contact_phone IS NOT NULL OR contact_email IS NOT NULL THEN '✅'
    ELSE '⏳'
  END as has_contact
FROM job_listings
WHERE is_external = true
ORDER BY discovered_at DESC
LIMIT 5;
EOF

echo ""
echo "Run this script anytime: ./check-scraping-progress.sh"
