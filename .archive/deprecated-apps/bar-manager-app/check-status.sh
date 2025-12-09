#!/bin/bash

# World-Class Bar Manager - Implementation Status Checker
# Checks which components exist and which need to be created

set -e

BASE_DIR="/Users/jeanbosco/workspace/easymo-/bar-manager-app"

cd "$BASE_DIR"

echo "🔍 Checking World-Class Bar Manager Implementation Status..."
echo "================================================================================"
echo ""

# Function to check if file exists
check_file() {
    local file=$1
    local desc=$2
    if [ -f "$file" ]; then
        echo "  ✅ $desc"
        return 0
    else
        echo "  ❌ $desc"
        return 1
    fi
}

# Function to check directory
check_dir() {
    local dir=$1
    local desc=$2
    if [ -d "$dir" ]; then
        echo "  ✅ $desc (directory exists)"
        return 0
    else
        echo "  ❌ $desc (directory missing)"
        return 1
    fi
}

# Core Foundation
echo "📦 Phase 1: Core Foundation & Design System"
check_file "lib/design-tokens.ts" "Design tokens"
check_file "lib/utils.ts" "Utilities"
check_file "lib/format-utils.ts" "Format utilities"
echo ""

# Hooks
echo "🎣 Hooks Status"
check_file "hooks/useOrders.ts" "Orders hook"
check_file "hooks/useTables.ts" "Tables hook"
check_file "hooks/useAnalytics.ts" "Analytics hook"
check_file "hooks/useSoundEffects.ts" "Sound effects hook"
check_file "hooks/useKeyboardShortcuts.ts" "Keyboard shortcuts hook"
check_file "hooks/usePrinter.ts" "Printer hook"
check_file "hooks/useRealtime.ts" "Realtime hook"
check_file "hooks/useMultiWindow.ts" "Multi-window hook"
echo ""

# UI Components
echo "🎨 Base UI Components"
check_file "components/ui/Button.tsx" "Button"
check_file "components/ui/Card.tsx" "Card"
check_file "components/ui/Input.tsx" "Input"
check_file "components/ui/Badge.tsx" "Badge"
check_file "components/ui/Dropdown.tsx" "Dropdown"
check_file "components/ui/CommandPalette.tsx" "Command Palette"
echo ""

# Dashboard Components
echo "📊 Dashboard Components"
check_dir "components/dashboard" "Dashboard directory"
check_file "components/dashboard/CommandCenter.tsx" "Command Center"
check_file "components/dashboard/QuickStats.tsx" "Quick Stats"
check_file "components/dashboard/LiveOrderFeed.tsx" "Live Order Feed"
check_file "components/dashboard/RevenueChart.tsx" "Revenue Chart"
check_file "components/dashboard/TableOverview.tsx" "Table Overview"
check_file "components/dashboard/StaffStatus.tsx" "Staff Status"
check_file "components/dashboard/AlertsWidget.tsx" "Alerts Widget"
check_file "components/dashboard/WeatherWidget.tsx" "Weather Widget"
echo ""

# Order Components
echo "📦 Order Management Components"
check_dir "components/orders" "Orders directory"
check_file "components/orders/OrderQueue.tsx" "Order Queue"
check_file "components/orders/OrderCard.tsx" "Order Card"
check_file "components/orders/OrderDetail.tsx" "Order Detail"
check_file "components/orders/OrderTimeline.tsx" "Order Timeline"
check_file "components/orders/KitchenDisplay.tsx" "Kitchen Display"
check_file "components/orders/BillSplitter.tsx" "Bill Splitter"
echo ""

# Table Components
echo "🪑 Table Management Components"
check_dir "components/tables" "Tables directory"
check_file "components/tables/FloorPlan.tsx" "Floor Plan"
check_file "components/tables/FloorPlanEditor.tsx" "Floor Plan Editor"
check_file "components/tables/TableCard.tsx" "Table Card"
check_file "components/tables/TableEditor.tsx" "Table Editor"
echo ""

# Menu Components
echo "🍽️ Menu Management Components"
check_dir "components/menu" "Menu directory"
check_file "components/menu/MenuEditor.tsx" "Menu Editor"
check_file "components/menu/CategoryManager.tsx" "Category Manager"
check_file "components/menu/ItemCard.tsx" "Item Card"
check_file "components/menu/ItemEditor.tsx" "Item Editor"
echo ""

# Inventory Components
echo "📦 Inventory Management Components"
check_dir "components/inventory" "Inventory directory"
check_file "components/inventory/StockOverview.tsx" "Stock Overview"
check_file "components/inventory/InventoryTable.tsx" "Inventory Table"
check_file "components/inventory/StockAlerts.tsx" "Stock Alerts"
echo ""

# Staff Components
echo "👥 Staff Management Components"
check_dir "components/staff" "Staff directory"
check_file "components/staff/StaffDirectory.tsx" "Staff Directory"
check_file "components/staff/ScheduleCalendar.tsx" "Schedule Calendar"
check_file "components/staff/TimeClock.tsx" "Time Clock"
echo ""

# Analytics Components
echo "📈 Analytics Components"
check_dir "components/analytics" "Analytics directory"
check_file "components/analytics/SalesCharts.tsx" "Sales Charts"
check_file "components/analytics/CustomerInsights.tsx" "Customer Insights"
check_file "components/analytics/TrendPredictor.tsx" "Trend Predictor"
echo ""

# Layout Components
echo "🎯 Layout Components"
check_dir "components/layout" "Layout directory"
check_file "components/layout/Sidebar.tsx" "Sidebar"
check_file "components/layout/Header.tsx" "Header"
check_file "components/layout/CommandBar.tsx" "Command Bar"
check_file "components/layout/NotificationCenter.tsx" "Notification Center"
echo ""

# App Routes
echo "🚀 App Routes"
check_file "app/(dashboard)/page.tsx" "Dashboard home"
check_file "app/(dashboard)/orders/page.tsx" "Orders page"
check_file "app/(dashboard)/tables/page.tsx" "Tables page"
check_file "app/(dashboard)/menu/page.tsx" "Menu page"
check_file "app/kds/page.tsx" "Kitchen Display System"
echo ""

# Count totals
echo "================================================================================"
echo ""
echo "📊 Implementation Summary:"
echo ""
echo "Run the following to get detailed counts:"
echo "  find components -name '*.tsx' | wc -l    # Existing components"
echo "  find app -name 'page.tsx' | wc -l         # Existing pages"
echo "  find hooks -name '*.ts' | wc -l           # Existing hooks"
echo ""
echo "📝 Next Steps:"
echo "  1. Run './setup-directories.sh' to create missing directories"
echo "  2. See WORLD_CLASS_IMPLEMENTATION_GUIDE.md for component details"
echo "  3. Start implementing missing components based on priority"
echo ""
echo "🎯 Priority Components to Create:"
echo "  - components/dashboard/CommandCenter.tsx"
echo "  - components/dashboard/QuickStats.tsx"
echo "  - components/orders/OrderDetail.tsx"
echo "  - app/kds/page.tsx"
echo "  - components/tables/FloorPlanEditor.tsx"
