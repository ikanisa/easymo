#!/bin/bash
# Quick start script for Google Maps pharmacy scraper

set -e

echo "🏥 Google Maps Pharmacy Scraper - Quick Start"
echo "=============================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install it first."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install it first."
    exit 1
fi

echo "✓ pip3 found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pip3 install -q -r scripts/requirements-scraper.txt

echo "✓ Dependencies installed"

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."

if [ -z "$SUPABASE_URL" ] && [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ SUPABASE_URL not set!"
    echo "   Export it: export SUPABASE_URL='https://your-project.supabase.co'"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY not set!"
    echo "   Export it: export SUPABASE_SERVICE_ROLE_KEY='eyJhbG...'"
    echo "   ⚠️  Use SERVICE ROLE key, not anon key!"
    exit 1
fi

echo "✓ Environment variables set"

# Check if URL is provided
if [ -z "$1" ]; then
    echo ""
    echo "❌ Missing Google Maps URL!"
    echo ""
    echo "Usage: ./scripts/scrape-pharmacies.sh <GOOGLE_MAPS_URL> [OPTIONS]"
    echo ""
    echo "Example:"
    echo "  ./scripts/scrape-pharmacies.sh \\"
    echo "    'https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z' \\"
    echo "    --dry-run --output pharmacies.json"
    echo ""
    echo "Options:"
    echo "  --dry-run          Preview without inserting to database"
    echo "  --output FILE      Save scraped data to JSON file"
    echo "  --max-results N    Maximum businesses to scrape (default: 100)"
    echo "  --city CITY        City name (default: Kigali)"
    echo "  --country COUNTRY  Country name (default: Rwanda)"
    echo "  --headless         Run browser in headless mode"
    exit 1
fi

# Extract URL and additional arguments
GMAPS_URL="$1"
shift  # Remove first argument
EXTRA_ARGS="$@"

# Run scraper
echo ""
echo "🚀 Starting scraper..."
echo "   URL: $GMAPS_URL"
echo "   Args: $EXTRA_ARGS"
echo ""

python3 scripts/gmaps_scraper.py "$GMAPS_URL" $EXTRA_ARGS

echo ""
echo "✅ Done!"
