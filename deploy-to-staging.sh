#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deploying AI Agent Ecosystem to Staging (Local)         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:57322/postgres"
echo -e "${GREEN}✅ Using local Supabase${NC}"

supabase db reset --local
