#!/bin/bash
# ==============================================================================
# Root Directory Cleanup Script
# ==============================================================================
# Description: Organizes 80+ documentation files into proper structure
# Author: Production Readiness Initiative
# Date: 2025-11-27
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Dry run mode
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  log_warning "DRY RUN MODE - No files will be moved"
fi

# Create directory structure
create_directories() {
  log_info "Creating documentation directory structure..."
  
  local dirs=(
    "docs/sessions"
    "docs/deployment"
    "docs/architecture"
    "docs/implementation"
    "docs/pwa"
  )
  
  for dir in "${dirs[@]}"; do
    if [ "$DRY_RUN" = false ]; then
      mkdir -p "$dir"
      log_success "Created $dir"
    else
      log_info "[DRY RUN] Would create $dir"
    fi
  done
}

# Move files to appropriate locations
move_file() {
  local src="$1"
  local dest="$2"
  
  if [ ! -f "$src" ]; then
    return
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY RUN] Would move $src → $dest"
  else
    mkdir -p "$(dirname "$dest")"
    mv "$src" "$dest"
    log_success "Moved $(basename "$src") → $dest"
  fi
}

# Organize session/status files
organize_sessions() {
  log_info "Organizing session and status files..."
  
  local session_patterns=(
    "*_COMPLETE.md"
    "*_STATUS.md"
    "*_SUMMARY.md"
    "*_SUMMARY_*.md"
    "SESSION_*.md"
    "*_TRACKER.md"
  )
  
  for pattern in "${session_patterns[@]}"; do
    for file in $pattern 2>/dev/null; do
      if [ -f "$file" ]; then
        move_file "$file" "docs/sessions/$file"
      fi
    done
  done
}

# Organize deployment documentation
organize_deployment() {
  log_info "Organizing deployment documentation..."
  
  local deployment_files=(
    "DEPLOYMENT_GUIDE.md"
    "DEPLOYMENT_ARCHITECTURE.md"
    "CLIENT_PWA_DEPLOYMENT.md"
    "CLIENT_PWA_DEPLOYMENT_FILES_INDEX.md"
    "CLIENT_PWA_DEPLOY_START_HERE.md"
    "CLIENT_PWA_DEPLOY_STATUS.md"
    "GIT_COMMIT_PLAN.md"
  )
  
  for file in "${deployment_files[@]}"; do
    move_file "$file" "docs/deployment/$file"
  done
}

# Organize architecture documentation
organize_architecture() {
  log_info "Organizing architecture documentation..."
  
  local arch_patterns=(
    "*_VISUAL*.txt"
    "*_ARCHITECTURE*.txt"
    "DETAILED_IMPLEMENTATION_PLAN.md"
  )
  
  for pattern in "${arch_patterns[@]}"; do
    for file in $pattern 2>/dev/null; do
      if [ -f "$file" ]; then
        move_file "$file" "docs/architecture/$file"
      fi
    done
  done
}

# Organize implementation documentation
organize_implementation() {
  log_info "Organizing implementation documentation..."
  
  local impl_files=(
    "IMPLEMENTATION_COMPLETE.md"
    "IMPLEMENTATION_SUMMARY*.md"
    "PENDING_IMPLEMENTATION_TASKS.md"
    "DETAILED_IMPLEMENTATION_PLAN.md"
    "PRODUCTION_READINESS_IMPLEMENTATION*.md"
    "START_PHASE_*.md"
  )
  
  for file in "${impl_files[@]}"; do
    move_file "$file" "docs/implementation/$file"
  done
}

# Organize PWA documentation
organize_pwa() {
  log_info "Organizing PWA documentation..."
  
  local pwa_patterns=(
    "CLIENT_PWA_*.md"
  )
  
  for pattern in "${pwa_patterns[@]}"; do
    for file in $pattern 2>/dev/null; do
      if [ -f "$file" ] && [[ ! "$file" =~ DEPLOYMENT ]]; then
        move_file "$file" "docs/pwa/$file"
      fi
    done
  done
}

# Create index files
create_index_files() {
  log_info "Creating index files..."
  
  if [ "$DRY_RUN" = false ]; then
    # docs/sessions/README.md
    cat > docs/sessions/README.md << 'EOF'
# Session Notes & Status Reports

This directory contains historical session notes, status reports, and progress trackers from development sessions.

## Organization

- `*_COMPLETE.md` - Completion reports
- `*_STATUS.md` - Status snapshots
- `*_SUMMARY.md` - Session summaries
- `*_TRACKER.md` - Progress trackers

## Note

These files are kept for historical reference. For current project status, see:
- [PRODUCTION_READINESS_IMPLEMENTATION_STATUS.md](../../PRODUCTION_READINESS_IMPLEMENTATION_STATUS.md)
- [README.md](../../README.md)
EOF
    log_success "Created docs/sessions/README.md"
    
    # docs/deployment/README.md
    cat > docs/deployment/README.md << 'EOF'
# Deployment Documentation

This directory contains all deployment-related documentation.

## Key Files

- `DEPLOYMENT_GUIDE.md` - Main deployment guide
- `DEPLOYMENT_ARCHITECTURE.md` - Architecture overview
- `CLIENT_PWA_*.md` - PWA deployment specifics

## Quick Links

- [Deployment Scripts](../../scripts/deploy/)
- [Verification Scripts](../../scripts/verify/)
EOF
    log_success "Created docs/deployment/README.md"
    
    # docs/implementation/README.md
    cat > docs/implementation/README.md << 'EOF'
# Implementation Documentation

This directory contains detailed implementation plans and progress reports.

## Current Status

See [PRODUCTION_READINESS_IMPLEMENTATION_STATUS.md](../../PRODUCTION_READINESS_IMPLEMENTATION_STATUS.md) for current implementation status.

## Historical Documents

This directory archives historical implementation plans and summaries.
EOF
    log_success "Created docs/implementation/README.md"
  fi
}

# Clean up empty directories
cleanup_empty_dirs() {
  log_info "Cleaning up empty directories..."
  
  if [ "$DRY_RUN" = false ]; then
    find docs -type d -empty -delete 2>/dev/null || true
    log_success "Removed empty directories"
  else
    log_info "[DRY RUN] Would remove empty directories"
  fi
}

# Summary report
show_summary() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                           ║${NC}"
  echo -e "${GREEN}║     Documentation Cleanup Complete       ║${NC}"
  echo -e "${GREEN}║                                           ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
  echo ""
  
  if [ "$DRY_RUN" = false ]; then
    log_info "Documentation structure:"
    tree -L 2 -d docs/ 2>/dev/null || ls -R docs/
  else
    log_warning "This was a DRY RUN - no changes were made"
    log_info "Run without --dry-run to apply changes"
  fi
}

# Main execution
main() {
  echo -e "${BLUE}"
  cat << "EOF"
╔═══════════════════════════════════════════╗
║                                           ║
║  Root Directory Cleanup                   ║
║  Issue #1: Documentation Organization     ║
║                                           ║
╚═══════════════════════════════════════════╝
EOF
  echo -e "${NC}\n"
  
  create_directories
  organize_sessions
  organize_deployment
  organize_architecture
  organize_implementation
  organize_pwa
  create_index_files
  cleanup_empty_dirs
  show_summary
}

# Run main
main "$@"
