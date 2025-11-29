#!/bin/bash
# Documentation Archive Script
# Organizes root-level markdown files into categorized archive folders

set -e

ARCHIVE_DATE=$(date +%Y%m%d)
ARCHIVE_BASE="docs/archive"

echo "🗂️  EasyMO Documentation Archive"
echo "================================"
echo "Date: $(date +%Y-%m-%d)"
echo ""

# Create archive directories
mkdir -p "$ARCHIVE_BASE/ai-implementation-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/phase-reports-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/production-readiness-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/implementation-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/whatsapp-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/microservices-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/client-pwa-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/admin-desktop-$ARCHIVE_DATE"
mkdir -p "$ARCHIVE_BASE/misc-$ARCHIVE_DATE"

# Archive AI-related docs
echo "📦 Archiving AI documentation..."
find . -maxdepth 1 -name "AI_*.md" -o -name "AI_*.txt" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/ai-implementation-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive phase reports
echo "📦 Archiving phase reports..."
find . -maxdepth 1 -name "PHASE*.md" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/phase-reports-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive production docs
echo "📦 Archiving production readiness docs..."
find . -maxdepth 1 -name "PRODUCTION*.md" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/production-readiness-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive implementation docs
echo "📦 Archiving implementation docs..."
find . -maxdepth 1 -name "IMPLEMENTATION*.md" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/implementation-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive WhatsApp docs
echo "📦 Archiving WhatsApp docs..."
find . -maxdepth 1 \( -name "WHATSAPP*.md" -o -name "WA_*.md" \) | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/whatsapp-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive microservices docs
echo "📦 Archiving microservices docs..."
find . -maxdepth 1 -name "MICROSERVICES*.md" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/microservices-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive client PWA docs
echo "📦 Archiving client PWA docs..."
find . -maxdepth 1 -name "CLIENT_PWA*.md" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/client-pwa-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive admin desktop docs
echo "📦 Archiving admin desktop docs..."
find . -maxdepth 1 \( -name "ADMIN*.md" -o -name "DESKTOP*.md" \) | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/admin-desktop-$ARCHIVE_DATE/" && echo "  ✓ $(basename $file)"
done

# Archive misc docs (but keep essential ones)
echo "📦 Archiving miscellaneous docs..."
EXCLUDE_PATTERN="README|CONTRIBUTING|CHANGELOG|QUICKSTART|QUICK_REFERENCE|COUNTRIES"
find . -maxdepth 1 -name "*.md" | grep -Ev "$EXCLUDE_PATTERN" | while read file; do
    [ -f "$file" ] && mv "$file" "$ARCHIVE_BASE/misc-$ARCHIVE_DATE/" 2>/dev/null && echo "  ✓ $(basename $file)"
done

echo ""
echo "✅ Archive complete!"
echo "📁 Archives created in: $ARCHIVE_BASE/"
echo ""
echo "Remaining essential docs:"
ls -1 *.md 2>/dev/null | head -10 || echo "  (all archived)"
