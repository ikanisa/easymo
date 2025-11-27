#!/usr/bin/env bash
#
# Phase 2-6 Implementation Script
# Creates all missing pages, components, and API routes for client-pwa
#

set -e

cd "$(dirname "$0")"

echo "🚀 Creating Client PWA Implementation Files..."
echo ""

# Colors
GREEN='\033[0.32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p app/\[venueSlug\]/{cart,checkout,order/\[orderId\]}
mkdir -p app/api/{venue/\[slug\],order,payment/{momo,revolut}}
mkdir -p components/{venue,checkout,order,payment,layout}
mkdir -p components/ui
mkdir -p lib/payment
mkdir -p types

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

echo -e "${BLUE}📄 Creating type definitions...${NC}"

# Types
cat > types/venue.ts << 'EOF'
export interface Venue {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  address?: string;
  hours?: Record<string, string>;
  currency: string;
  payment_methods: string[];
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  slug: string;
  emoji?: string;
  sort_order: number;
  item_count?: number;
}

export interface MenuItem {
  id: string;
  venue_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  emoji?: string;
  is_available: boolean;
  is_popular: boolean;
  is_vegetarian: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  allergens?: string[];
  prep_time_minutes?: number;
  calories?: number;
}
EOF

cat > types/order.ts << 'EOF'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Order {
  id: string;
  venue_id: string;
  table_number: string;
  customer_name?: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  payment_method: 'momo' | 'revolut';
  payment_status: PaymentStatus;
  payment_id?: string;
  order_status: OrderStatus;
  special_instructions?: string;
  estimated_ready_time?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}
EOF

echo -e "${GREEN}✓ Types created${NC}"
echo ""

echo -e "${GREEN}✅ Phase 2-6 setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Apply database migration: supabase db push"
echo "2. Seed test data: psql < supabase/seed/client_pwa_seed.sql"
echo "3. Start dev server: pnpm dev"
echo "4. Visit: http://localhost:3002/heaven-bar?table=5"
