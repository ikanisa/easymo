#!/bin/bash
set -e

# EasyMO Observability Infrastructure Setup Script
# This script sets up the complete monitoring stack

echo "🚀 EasyMO Observability Infrastructure Setup"
echo "=============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from monitoring directory
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo -e "${RED}❌ Error: Please run this script from the monitoring/ directory${NC}"
    exit 1
fi

echo "📋 Step 1: Checking prerequisites..."
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from example...${NC}"
    cat > .env <<EOF
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin123
# ⚠️  CHANGE THIS IN PRODUCTION!

# Database Connection (Agent Core Postgres)
AGENT_CORE_DATABASE_URL=postgresql://postgres:password@postgres:5432/easymo

# Redis Connection
REDIS_URL=redis://redis:6379

# Email Alerts (SendGrid)
SENDGRID_API_KEY=

# Slack Webhook (Optional)
SLACK_WEBHOOK_URL=
EOF
    echo -e "${YELLOW}📝 Please edit .env file and set your credentials${NC}"
    echo -e "${YELLOW}Press Enter to continue after editing .env...${NC}"
    read
fi

echo ""
echo "📦 Step 2: Creating Docker network..."
echo ""

# Create external network if it doesn't exist
if ! docker network inspect easymo &> /dev/null; then
    docker network create easymo
    echo -e "${GREEN}✅ Network 'easymo' created${NC}"
else
    echo -e "${GREEN}✅ Network 'easymo' already exists${NC}"
fi

echo ""
echo "🏗️  Step 3: Starting monitoring stack..."
echo ""

# Pull images
echo "Pulling Docker images..."
docker-compose -f docker-compose.monitoring.yml pull

# Start services
echo "Starting services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Step 4: Checking service health..."
echo ""

services=(
    "easymo-prometheus:9090"
    "easymo-grafana:3000"
    "easymo-loki:3100"
    "easymo-tempo:3200"
    "easymo-alertmanager:9093"
)

all_healthy=true

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    
    if docker ps | grep -q "$name"; then
        echo -e "${GREEN}✅ $name is running${NC}"
    else
        echo -e "${RED}❌ $name is not running${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    echo ""
    echo -e "${RED}❌ Some services failed to start. Check logs with:${NC}"
    echo "   docker-compose -f docker-compose.monitoring.yml logs"
    exit 1
fi

echo ""
echo "📊 Step 5: Verifying Prometheus targets..."
echo ""

# Wait a bit more for Prometheus to start scraping
sleep 5

# Check Prometheus targets
if curl -s http://localhost:9090/api/v1/targets | grep -q "up"; then
    echo -e "${GREEN}✅ Prometheus is scraping targets${NC}"
else
    echo -e "${YELLOW}⚠️  Prometheus targets may not be configured yet${NC}"
    echo -e "${YELLOW}   This is normal if microservices are not running${NC}"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Access Monitoring Services:"
echo ""
echo "  Grafana:         http://localhost:3001"
echo "                   Login: admin / (see .env)"
echo ""
echo "  Prometheus:      http://localhost:9090"
echo ""
echo "  Alertmanager:    http://localhost:9093"
echo ""
echo "  Loki (API):      http://localhost:3100"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo ""
echo "  1. Rebuild @easymo/commons package:"
echo "     cd .. && pnpm --filter @easymo/commons build"
echo ""
echo "  2. Rebuild and restart microservices to expose /metrics endpoints"
echo ""
echo "  3. Open Grafana and explore the 'EasyMO - System Overview' dashboard"
echo ""
echo "  4. Configure alert email/Slack in .env and restart:"
echo "     docker-compose -f docker-compose.monitoring.yml restart alertmanager"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation: monitoring/README.md"
echo ""
echo "🐛 Troubleshooting:"
echo "   View logs:    docker-compose -f docker-compose.monitoring.yml logs -f"
echo "   Stop stack:   docker-compose -f docker-compose.monitoring.yml down"
echo "   Restart:      docker-compose -f docker-compose.monitoring.yml restart"
echo ""
echo -e "${GREEN}✅ Monitoring stack is ready!${NC}"
echo ""
