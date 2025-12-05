#!/bin/bash
set -e

echo "🗑️  Removing Web Crawling Infrastructure"
echo "========================================"
echo ""

# Remove Supabase Edge Functions
echo "📁 Removing edge functions..."
rm -rf supabase/functions/job-crawler
rm -rf supabase/functions/source-url-scraper
rm -rf supabase/functions/job-sources-sync

# Remove Python crawler
echo "🐍 Removing Python crawler..."
rm -rf crawler/
rm -f test_crawler.ts

# Remove deploy scripts
echo "📜 Removing deploy scripts..."
rm -f scripts/deploy/deploy-comprehensive-scraping.sh
rm -f scripts/checks/check-scraping-progress.sh

# Archive scraping documentation
echo "📚 Archiving scraping documentation..."
mkdir -p docs/archive/scraping
mv docs/archive/deployment/QUICKSTART_SCRAPING.md docs/archive/scraping/ 2>/dev/null || true
mv docs/archive/status/SOURCE_URL_SCRAPER_IMPLEMENTATION.md docs/archive/scraping/ 2>/dev/null || true
mv docs/architecture/diagrams/SCRAPING_ARCHITECTURE_DIAGRAM.txt docs/archive/scraping/ 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📋 Summary of changes:"
echo "  - Removed: job-crawler edge function"
echo "  - Removed: source-url-scraper edge function"
echo "  - Removed: job-sources-sync edge function"
echo "  - Removed: crawler/ Python directory"
echo "  - Removed: Scraping deploy scripts"
echo "  - Archived: Scraping documentation"
echo ""
echo "✅ Kept:"
echo "  - job_sources table (for Deep Search targeting)"
echo "  - real_estate_sources table (for Deep Search targeting)"
echo "  - farmers_sources table (for Deep Search targeting)"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy migration: supabase db push"
echo "  2. Test Deep Search tools via WhatsApp"
echo "  3. Monitor Deep Research Service logs"
