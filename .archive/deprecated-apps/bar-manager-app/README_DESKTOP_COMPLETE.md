# 🍽️ World-Class Bar & Restaurant Manager

> **A comprehensive desktop application for managing bars and restaurants with real-time order management, kitchen display systems, inventory tracking, staff management, and business analytics.**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.1.6-black)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue)

---

## ✨ Features

### 📊 Command Center Dashboard
- **Real-time metrics**: Revenue, orders, tables, wait times
- **Customizable widgets**: Drag-and-drop dashboard layout
- **Live activity feed**: See what's happening in real-time
- **Multi-monitor support**: Display KDS on separate screens

### 🍽️ Order Management
- **Live order queue**: Kanban-style order tracking
- **Status workflow**: Pending → Confirmed → Preparing → Ready → Served
- **WhatsApp integration**: Orders from WhatsApp customers
- **Split bills**: Flexible bill splitting options
- **Kitchen Display System (KDS)**: Dedicated kitchen screen mode

### 🪑 Table Management
- **Visual floor plan**: Drag-and-drop table layout editor
- **Real-time status**: Available, Occupied, Reserved, Dirty, Blocked
- **Section management**: Organize tables by sections
- **Reservation overlay**: See upcoming reservations on floor plan

### 📦 Inventory Management
- **Real-time stock levels**: Know what's in stock
- **Auto reorder alerts**: Never run out of popular items
- **Supplier management**: Track suppliers and orders
- **Waste tracking**: Monitor and reduce waste
- **Recipe costing**: Calculate dish costs accurately
- **Barcode scanning**: Quick stock updates

### 👥 Staff Management
- **Shift scheduling**: Visual calendar-based scheduling
- **Time clock**: Clock in/out with performance tracking
- **Performance analytics**: Track server performance
- **Role-based access**: Granular permissions
- **Training modules**: Onboard new staff efficiently

### 📈 Analytics & Reports
- **Sales analytics**: Revenue trends and forecasts
- **Customer insights**: Know your customers better
- **AI trend predictions**: Forecast demand and optimize inventory
- **Custom reports**: Build reports your way
- **Export options**: Excel, PDF, CSV exports
- **Comparison charts**: Compare periods and metrics

### 💳 Payments & Finance
- **Payment reconciliation**: End-of-day cash-up
- **Daily cash reports**: Track cash flow
- **Tip management**: Fair tip distribution
- **Invoice generation**: Professional invoices
- **Tax reporting**: Automated tax calculations

### 🔔 Notifications & Alerts
- **Desktop notifications**: Never miss important events
- **Sound alerts**: Configurable audio feedback
- **Priority escalation**: Delayed orders highlighted
- **Custom alert rules**: Set your own thresholds
- **SMS/Email alerts**: External notifications

### 🖥️ Desktop Capabilities
- **Multi-window management**: KDS, POS, and admin in separate windows
- **Keyboard shortcuts**: Power-user productivity (50+ shortcuts)
- **System tray integration**: Quick access from taskbar
- **Printer integration**: Direct printing to thermal printers
- **Barcode/QR scanner**: Hardware scanner support
- **Offline mode**: Keep working during internet outages
- **Auto-updates**: Always stay up-to-date

### 🤖 AI & Automation
- **Demand forecasting**: Predict busy periods
- **Smart inventory**: Auto-suggest reorder quantities
- **Auto-scheduling**: Optimize staff schedules
- **Chatbot assistant**: Natural language interface
- **Voice commands**: Hands-free operation
- **Anomaly detection**: Spot unusual patterns
- **Natural language reports**: Ask questions, get answers

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10.18.3+
- Rust (for Tauri desktop features)

### Installation

```bash
# Clone the repository (if not already in monorepo)
cd bar-manager-app

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Set up directories
chmod +x setup-directories.sh
./setup-directories.sh

# Check implementation status
chmod +x check-status.sh
./check-status.sh
```

### Development

```bash
# Start Next.js development server
pnpm dev

# Start Tauri desktop app
pnpm tauri dev

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Building

```bash
# Build Next.js app
pnpm build

# Build desktop app for current platform
pnpm tauri build

# Build for all platforms (Windows, macOS, Linux)
pnpm tauri build --target all
```

---

## 📁 Project Structure

```
bar-manager-app/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard layout group
│   │   ├── page.tsx              # Command Center
│   │   ├── orders/               # Order management
│   │   ├── tables/               # Table management
│   │   ├── menu/                 # Menu management
│   │   ├── inventory/            # Inventory
│   │   ├── staff/                # Staff management
│   │   ├── analytics/            # Analytics
│   │   ├── payments/             # Payments
│   │   └── settings/             # Settings
│   ├── kds/                      # Kitchen Display System
│   └── pos/                      # POS mode
│
├── components/
│   ├── ui/                       # Base UI components
│   ├── dashboard/                # Dashboard widgets
│   ├── orders/                   # Order components
│   ├── tables/                   # Table components
│   ├── menu/                     # Menu components
│   ├── inventory/                # Inventory components
│   ├── staff/                    # Staff components
│   ├── analytics/                # Analytics components
│   ├── payments/                 # Payment components
│   ├── ai/                       # AI features
│   ├── layout/                   # Layout components
│   └── print/                    # Print templates
│
├── hooks/                        # React hooks
│   ├── useOrders.ts              # Order management
│   ├── useTables.ts              # Table management
│   ├── useAnalytics.ts           # Analytics
│   ├── useKeyboardShortcuts.ts   # Keyboard shortcuts
│   ├── useSoundEffects.ts        # Sound effects
│   └── usePrinter.ts             # Printer integration
│
├── lib/                          # Utilities
│   ├── design-tokens.ts          # Design system
│   ├── utils.ts                  # General utilities
│   ├── format-utils.ts           # Formatting
│   ├── printer/                  # Printer drivers
│   ├── scanner/                  # Scanner integration
│   ├── ai/                       # AI features
│   └── export/                   # Export utilities
│
├── stores/                       # State management
│   ├── orders.store.ts           # Orders state
│   ├── tables.store.ts           # Tables state
│   ├── ui.store.ts               # UI state
│   └── settings.store.ts         # Settings
│
├── src-tauri/                    # Tauri desktop app
│   ├── src/
│   │   ├── main.rs               # Main entry
│   │   └── commands/             # Tauri commands
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri config
│
└── public/                       # Static assets
    ├── sounds/                   # Sound effects
    ├── icons/                    # App icons
    └── fonts/                    # Custom fonts
```

---

## ⌨️ Keyboard Shortcuts

### Navigation
- `⌘/Ctrl + 1` - Dashboard
- `⌘/Ctrl + 2` - Orders
- `⌘/Ctrl + 3` - Tables
- `⌘/Ctrl + 4` - Menu
- `⌘/Ctrl + 5` - Inventory
- `⌘/Ctrl + 6` - Staff
- `⌘/Ctrl + 7` - Analytics

### Actions
- `⌘/Ctrl + N` - New Order
- `⌘/Ctrl + P` - Print
- `⌘/Ctrl + S` - Save
- `⌘/Ctrl + F` - Search
- `⌘/Ctrl + K` - Command Palette

### Quick Actions
- `Space` - Quick action on selected item
- `Enter` - Confirm/Open
- `Escape` - Cancel/Close
- `Delete` - Delete selected

### View
- `⌘/Ctrl + \` - Toggle Sidebar
- `⌘/Ctrl + Shift + F` - Fullscreen
- `⌘/Ctrl + Shift + K` - Open KDS

### Help
- `⌘/Ctrl + /` - Show all shortcuts

---

## 🎨 Design System

### Colors
- **Primary**: `#f9a825` (Warm amber)
- **Secondary**: `#ff6b35` (Energetic orange)
- **Accent**: `#00d9ff` (Cyan)
- **Success**: `#10b981` (Emerald)
- **Warning**: `#f59e0b` (Amber)
- **Error**: `#ef4444` (Red)

### Typography
- **Sans**: Inter Variable, SF Pro Display
- **Mono**: JetBrains Mono, SF Mono
- **Display**: Cal Sans, Inter Variable

### Spacing
- Sidebar collapsed: `64px`
- Sidebar expanded: `280px`
- Header height: `56px`

---

## 🔌 Integrations

### Current
- ✅ Supabase (Database & Auth)
- ✅ WhatsApp (Order receiving)
- ✅ Thermal Printers (Receipt & kitchen tickets)

### Planned
- 🔄 Payment Gateways (Stripe, PayPal)
- 🔄 POS Systems (Square, Clover)
- 🔄 Delivery Platforms (Uber Eats, DoorDash)
- 🔄 Accounting Software (QuickBooks, Xero)
- 🔄 Email Marketing (Mailchimp, SendGrid)

---

## 📚 Documentation

- [Implementation Guide](./WORLD_CLASS_IMPLEMENTATION_GUIDE.md) - Detailed implementation instructions
- [Architecture](./docs/ARCHITECTURE.md) - System architecture
- [Design Tokens](./lib/design-tokens.ts) - Design system tokens
- [API Documentation](./docs/API.md) - API reference

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

## 📄 License

Part of the EasyMO platform. See [LICENSE](../../LICENSE) for details.

---

## 🆘 Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Create a GitHub issue
- **Email**: support@easymo.com

---

## 🎯 Roadmap

### Phase 1: Core Foundation ✅
- [x] Design system
- [x] Base hooks
- [x] UI components

### Phase 2: Order Management (In Progress) 🏗️
- [x] Order queue
- [x] Order cards
- [ ] Kitchen Display System
- [ ] Bill splitting
- [ ] Course management

### Phase 3: Table & Menu Management 📋
- [ ] Floor plan editor
- [ ] Table management
- [ ] Menu editor
- [ ] Modifier management

### Phase 4: Inventory & Staff 📋
- [ ] Stock tracking
- [ ] Supplier management
- [ ] Staff scheduling
- [ ] Time clock

### Phase 5: Analytics & Payments 📋
- [ ] Sales analytics
- [ ] Custom reports
- [ ] Payment reconciliation
- [ ] Tip management

### Phase 6: AI & Advanced Features 📋
- [ ] Demand forecasting
- [ ] Smart suggestions
- [ ] Voice commands
- [ ] Anomaly detection

---

**Built with ❤️ for bar and restaurant operators worldwide**
