# 🚀 Bar Manager App v2.0 - Implementation Guide

## Overview
This is a comprehensive world-class desktop application for bar and restaurant management built with:
- **Next.js 15** - React framework
- **Tauri 2.0** - Desktop app framework (Rust)
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Tanstack Query** - Data fetching
- **Framer Motion** - Animations
- **React Konva** - Canvas/Floor plan editor
- **Recharts** - Data visualization

## 📁 Project Structure

```
bar-manager-app/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard layout group
│   │   ├── layout.tsx            # Main dashboard layout
│   │   ├── page.tsx              # Command Center
│   │   ├── orders/               # Order management
│   │   ├── tables/               # Table & floor plan
│   │   ├── menu/                 # Menu management
│   │   ├── inventory/            # Stock management
│   │   ├── staff/                # Staff & scheduling
│   │   ├── analytics/            # Reports & analytics
│   │   ├── payments/             # Financial management
│   │   └── settings/             # App settings
│   ├── kds/                      # Kitchen Display System
│   └── api/                      # API routes
├── components/                   # React components
│   ├── ui/                       # Base UI components
│   ├── dashboard/                # Dashboard widgets
│   ├── orders/                   # Order components
│   ├── tables/                   # Table components
│   ├── menu/                     # Menu components
│   ├── inventory/                # Inventory components
│   ├── staff/                    # Staff components
│   ├── analytics/                # Analytics components
│   └── layout/                   # Layout components
├── hooks/                        # Custom React hooks
├── stores/                       # Zustand stores
├── lib/                          # Utilities & helpers
│   ├── supabase/                 # Supabase client
│   ├── printer/                  # Printer management
│   ├── ai/                       # AI features
│   └── utils.ts                  # General utilities
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Main entry
│   │   └── commands/             # Tauri commands
│   └── tauri.conf.json           # Tauri config
└── public/                       # Static assets
```

## 🎯 Key Features

### 1. Command Center (Dashboard)
- **Customizable widget grid** - Drag & drop, resize widgets
- **Real-time stats** - Revenue, orders, tables, staff
- **Live order feed** - New orders appear instantly
- **Multi-monitor support** - Open KDS on second screen
- **Quick actions** - Keyboard shortcuts for everything

### 2. Order Management
- **Live order queue** - Real-time order tracking
- **Kanban view** - Drag orders between statuses
- **Order detail panel** - Slide-out with full details
- **Kitchen Display System (KDS)** - Dedicated fullscreen view
- **Sound alerts** - Notification sounds for new orders
- **Priority escalation** - Visual warnings for delayed orders

### 3. Table Management
- **Visual floor plan editor** - Drag tables, resize, rotate
- **Real-time status** - Available, occupied, reserved, dirty
- **Section management** - Organize by areas
- **Reservation overlay** - See upcoming bookings
- **Table linking** - Combine tables for large parties

### 4. Menu Management
- **Visual menu editor** - Intuitive UI for menu items
- **Category management** - Organize menu structure
- **Modifiers & variations** - Add customization options
- **Dynamic pricing** - Time-based or demand pricing
- **Allergen tracking** - Mark allergens for safety
- **Photo management** - Upload menu item images

### 5. Inventory Management
- **Real-time stock levels** - Track inventory live
- **Auto-reorder alerts** - Never run out
- **Supplier management** - Track vendors
- **Recipe costing** - Calculate food costs
- **Waste tracking** - Monitor and reduce waste
- **Barcode scanning** - Quick stock updates

### 6. Staff Management
- **Shift scheduling** - Visual calendar
- **Time clock** - Clock in/out tracking
- **Performance analytics** - Sales per server
- **Role-based access** - Permissions management
- **Commission tracking** - Track sales commissions

### 7. Analytics & Reports
- **Sales charts** - Revenue visualization
- **Customer insights** - Behavior analysis
- **Trend predictions** - AI-powered forecasting
- **Export tools** - PDF, Excel, CSV
- **Comparison views** - Period-over-period analysis
- **Custom reports** - Build your own

### 8. Payments
- **Transaction history** - All payments logged
- **Daily reconciliation** - End-of-day cash reports
- **Tip management** - Track and distribute tips
- **Multi-currency** - Support multiple currencies

### 9. Desktop Features
- **Keyboard shortcuts** - Power user productivity
- **Multi-window** - Open multiple views
- **System tray** - Run in background
- **Printer integration** - Receipt & kitchen printers
- **Offline mode** - Works without internet
- **Auto-updates** - Seamless updates

### 10. AI Features
- **Demand forecasting** - Predict busy periods
- **Smart inventory** - AI-powered reorder suggestions
- **Auto-scheduling** - AI staff scheduling
- **Chatbot assistant** - Natural language queries
- **Anomaly detection** - Catch fraud/errors

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 10.18.3+
- Rust (for Tauri)
- Supabase account

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
pnpm dev

# Run with Tauri (desktop app)
pnpm tauri:dev

# Build for production
pnpm build
pnpm tauri:build
```

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI (optional)
GOOGLE_AI_API_KEY=your-google-ai-key

# Venue info
NEXT_PUBLIC_VENUE_NAME="Your Restaurant"
NEXT_PUBLIC_VENUE_CURRENCY=RWF
```

## 📝 Development Guidelines

### Code Style
- Use TypeScript for all files
- Follow Next.js 15 App Router conventions
- Use Tailwind CSS for styling
- Implement proper error handling
- Add loading states for async operations

### Component Structure
```typescript
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  // Props definition
}

export function MyComponent({ ...props }: MyComponentProps) {
  // Component logic
  
  return (
    <div className={cn('base-classes', conditional)}>
      {/* Component JSX */}
    </div>
  );
}
```

### State Management
- Use **Zustand** for global state
- Use **React Query** for server state
- Use **local state** for UI state

### Keyboard Shortcuts Convention
- `Cmd/Ctrl + K` - Command palette
- `Cmd/Ctrl + [1-9]` - Navigate sections
- `Cmd/Ctrl + N` - New order/item
- `Cmd/Ctrl + F` - Search
- `Cmd/Ctrl + P` - Print
- `Esc` - Close modals/panels

## 🎨 Design System

### Colors
- **Primary**: Warm amber (#f9a825)
- **Success**: Emerald (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)
- **Info**: Blue (#3b82f6)

### Typography
- **Font**: Inter Variable
- **Mono**: JetBrains Mono
- **Display**: Cal Sans

### Spacing
- **Sidebar**: 64px collapsed, 280px expanded
- **Header**: 56px
- **Grid gap**: 16px

## 📚 API Integration

### Supabase Tables
- `venues` - Restaurant/bar info
- `orders` - Order data
- `order_items` - Order line items
- `tables` - Table configuration
- `menu_items` - Menu products
- `menu_categories` - Menu organization
- `inventory_items` - Stock items
- `staff` - Employee data
- `shifts` - Work schedules
- `transactions` - Payment records

### Real-time Subscriptions
```typescript
supabase
  .channel('orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders'
  }, handleOrderChange)
  .subscribe();
```

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## 📦 Building & Deployment

### Web Version
```bash
pnpm build
pnpm start
```

### Desktop App
```bash
# Development
pnpm tauri:dev

# Production build
pnpm tauri:build

# Build for all platforms
pnpm tauri:build:all
```

## 🔧 Troubleshooting

### Common Issues

**Build fails with TypeScript errors**
```bash
pnpm type-check
# Fix errors, then rebuild
```

**Tauri window doesn't open**
- Check Rust installation
- Verify tauri.conf.json
- Check console for errors

**Real-time not working**
- Verify Supabase connection
- Check RLS policies
- Enable real-time in Supabase dashboard

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)

## 🤝 Contributing

This is an internal EasyMO project. Follow the coding standards in `docs/GROUND_RULES.md`.

## 📄 License

Proprietary - EasyMO Platform
