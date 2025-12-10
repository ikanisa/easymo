#!/bin/bash
# CI Check: Root Directory Cleanliness
# Enforces world-class repository standards
# Exit code 1 if unauthorized files found in root

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 Checking root directory cleanliness..."
echo ""

# Define allowed files and patterns
ALLOWED_PATTERNS=(
  # Version control
  "^\\.git$"
  "^\\.gitignore$"
  "^\\.gitattributes$"
  
  # Documentation
  "^README\\.md$"
  "^CHANGELOG\\.md$"
  "^CONTRIBUTING\\.md$"
  "^COUNTRIES\\.md$"
  "^LICENSE$"
  
  # Package management
  "^package\\.json$"
  "^package-lock\\.json$"
  "^pnpm-lock\\.yaml$"
  "^pnpm-workspace\\.yaml$"
  "^bun\\.lockb?$"
  "^\\.npmrc$"
  
  # TypeScript
  "^tsconfig.*\\.json$"
  
  # Build tools
  "^turbo\\.json$"
  "^vite\\.config\\.(ts|js|mjs)$"
  "^vitest.*\\.(ts|js|mjs)$"
  "^eslint\\.config.*\\.(mjs|js)$"
  "^prettier\\.config\\.(mjs|js)$"
  "^\\.prettierignore$"
  
  # Docker
  "^Dockerfile.*$"
  "^docker-compose.*\\.ya?ml$"
  "^\\.dockerignore$"
  
  # Cloud/Deploy
  "^cloudbuild.*\\.ya?ml$"
  "^\\.gcloudignore$"
  "^Makefile$"
  "^nginx\\.conf$"
  
  # Environment
  "^\\.env\\.example$"
  "^\\.env\\..*\\.template$"
  "^\\.env\\.local$"
  
  # Deno
  "^deno\\.json$"
  "^deno\\.lock$"
  
  # Misc configs
  "^\\.changeset$"
  "^\\.husky$"
  "^\\.ci$"
  
  # Logs (temporary)
  ".*\\.log$"
  
  # Supabase
  "^\\.supabase$"
)

# Get all files/dirs in root (excluding hidden by default, but we'll check all)
VIOLATIONS=()
VIOLATION_COUNT=0

for item in $(ls -A); do
  # Skip directories (they're organized separately)
  if [ -d "$item" ]; then
    # Check if it's an allowed directory
    case "$item" in
      .git|.github|.husky|.ci|.changeset|.agent|.archive|.supabase|node_modules)
        continue
        ;;
      admin-app|apps|backend|client-pwa|config|coverage|data|docs|infrastructure|migrations|monitoring|packages|public|real-estate-pwa|scripts|services|supabase|tests|tools|vendor-portal|waiter-pwa)
        continue
        ;;
      *)
        echo "❌ Unauthorized directory: $item"
        VIOLATIONS+=("$item")
        VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
        ;;
    esac
    continue
  fi
  
  # Check if file matches any allowed pattern
  ALLOWED=false
  for pattern in "${ALLOWED_PATTERNS[@]}"; do
    if echo "$item" | grep -E "$pattern" > /dev/null; then
      ALLOWED=true
      break
    fi
  done
  
  if [ "$ALLOWED" = false ]; then
    echo "❌ Unauthorized file: $item"
    VIOLATIONS+=("$item")
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
  fi
done

echo ""
if [ $VIOLATION_COUNT -eq 0 ]; then
  echo "✅ Root directory is clean! All files are authorized."
  exit 0
else
  echo "❌ Found $VIOLATION_COUNT unauthorized items in root directory"
  echo ""
  echo "🔧 How to fix:"
  echo ""
  echo "1. Move scripts to scripts/:"
  echo "   mv <file>.sh scripts/utility/"
  echo ""
  echo "2. Move SQL files to scripts/db/:"
  echo "   mv <file>.sql scripts/db/"
  echo ""
  echo "3. Move docs to docs/:"
  echo "   mv <file>.md docs/sessions/"
  echo ""
  echo "4. Move data files to scripts/data/:"
  echo "   mv <file>.{csv,json} scripts/data/"
  echo ""
  echo "5. Archive orphan files:"
  echo "   mv <file> .archive/manual-cleanup-\$(date +%Y%m%d)/"
  echo ""
  echo "See docs/REFACTORING_PROGRESS.md for full cleanup plan"
  exit 1
fi
