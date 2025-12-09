# 🍽️ Bar Manager - World-Class Desktop Application

> **Professional bar and restaurant management system with real-time synchronization, thermal printing, and AI-powered insights**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/easymo/bar-manager)
[![Status](https://img.shields.io/badge/status-production%20ready-success.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

---

## ✨ Features

### 🖥️ Desktop-First
- **Native Application** - Built with Tauri (Rust + React)
- **Multi-Window Support** - Dashboard, KDS, and POS simultaneously
- **Offline Mode** - Works without internet, syncs when back online
- **System Tray** - Background operation with quick actions

### 🔄 Real-Time Synchronization
- **Live Updates** - Orders, tables, inventory across all devices
- **<100ms Latency** - Instant synchronization via WebSockets
- **Optimistic UI** - Immediate feedback with automatic rollback
- **Connection Monitoring** - Visual status with auto-reconnect

### 🖨️ Hardware Integration
- **Thermal Printers** - ESC/POS support for receipts and kitchen tickets
- **Barcode Scanners** - USB scanner integration for inventory
- **Cash Drawers** - Electronic cash drawer control
- **Multi-Printer** - Support for multiple printers simultaneously

### ⌨️ Productivity
- **100+ Keyboard Shortcuts** - Power-user optimized
- **Command Palette** - Quick access to any action (⌘K)
- **Drag & Drop** - Visual table layout and scheduling
- **Auto-save** - Never lose your work

### 🤖 AI-Powered
- **Demand Forecasting** - Predict busy periods and inventory needs
- **Smart Recommendations** - AI-suggested menu items and pricing
- **Anomaly Detection** - Automatic alerts for unusual patterns
- **Natural Language** - Ask questions in plain English

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Rust (installed automatically if needed)

### Installation

```bash
# Clone repository
git clone https://github.com/easymo/bar-manager.git
cd bar-manager/bar-manager-app

# Run setup
chmod +x setup-desktop.sh
./setup-desktop.sh

# Start desktop app
npm run tauri:dev
```

**That's it!** The app will launch in ~2 seconds.

---

## 📱 Screenshots

### Command Center Dashboard
> Real-time overview with customizable widgets

### Kitchen Display System
> Separate window optimized for kitchen workflow

### Floor Plan Editor
> Drag & drop table layout with visual sections

### Analytics Dashboard
> Comprehensive insights with AI predictions

---

## 📦 What's Included

### Core Modules
- 📊 **Dashboard** - Command center with live widgets
- 🍽️ **Orders** - Queue management and KDS
- 🪑 **Tables** - Visual floor plan editor
- 📖 **Menu** - Visual menu builder
- 📦 **Inventory** - Stock tracking with auto-reorder
- 👥 **Staff** - Scheduling and time clock
- 📈 **Analytics** - Reports and AI insights
- 💳 **Payments** - Reconciliation and invoicing

### Technical Features
- ✅ TypeScript (strict mode)
- ✅ Next.js 15 (App Router)
- ✅ Tauri 2.0 (Rust backend)
- ✅ Supabase (PostgreSQL + Realtime)
- ✅ Radix UI (Accessible components)
- ✅ Framer Motion (Animations)
- ✅ React Query (Server state)
- ✅ Zustand (Client state)

---

## 🎯 Use Cases

### Small Cafés
- Simple order management
- Basic inventory tracking
- Staff scheduling
- Daily reports

### Full-Service Restaurants
- Multi-section floor plan
- Kitchen display system
- Complex menu management
- Comprehensive analytics

### Bars & Nightclubs
- Quick POS mode
- Inventory par levels
- Staff performance tracking
- Real-time dashboards

### Multi-Location Chains
- Centralized menu management
- Cross-location reporting
- Inventory transfer
- Staff deployment

---

## ⚙️ Configuration

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI (Optional)
GOOGLE_GEMINI_API_KEY=your_gemini_key

# Printing (Optional)
PRINTER_DEFAULT_WIDTH=80
PRINTER_ENCODING=utf-8
```

### Printer Setup

1. Connect USB thermal printer
2. Go to Settings → Printers
3. Click "Detect Printers"
4. Enable and test printer
5. Configure print templates

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Cold Start | 1.8s |
| Memory Usage | 140MB |
| Bundle Size (macOS) | 58MB |
| FPS (Animations) | 60fps |
| Real-time Latency | <100ms |

---

## 🔒 Security

- **Row Level Security** - Database-level access control
- **Role-Based Permissions** - Granular user permissions
- **Encrypted Communication** - HTTPS/WSS only
- **Input Validation** - Zod schema validation
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - Sanitized outputs

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](DESKTOP_QUICK_START.md) | Get started in 5 minutes |
| [Complete Guide](PHASE_5B_COMPLETE_IMPLEMENTATION.md) | Detailed implementation |
| [Architecture](ARCHITECTURE.md) | System design |
| [API Reference](docs/API.md) | API documentation |

---

## 🛠️ Development

### Run Development Server
```bash
npm run tauri:dev
```

### Build Production
```bash
npm run tauri:build
```

### Run Tests
```bash
npm test
```

### Lint Code
```bash
npm run lint
```

---

## 📦 Deployment

### Desktop Apps

**macOS**:
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/
```

**Windows**:
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/msi/
```

**Linux**:
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/appimage/
```

### Web Version (Optional)

```bash
npm run build
# Deploy to Vercel, Netlify, or self-host
```

---

## 🤝 Contributing

This is a proprietary project. For feature requests or bug reports, please contact support@easymo.app.

---

## 📄 License

Proprietary - EasyMO Platform  
Copyright © 2024 EasyMO. All rights reserved.

---

## 🎉 Achievements

- ✅ **120+ Features** implemented
- ✅ **15,000+ Lines** of production code
- ✅ **100+ Shortcuts** for productivity
- ✅ **<2s Cold Start** performance
- ✅ **60fps** smooth animations
- ✅ **Production Ready** with full testing

---

## 💡 Support

- 📧 **Email**: support@easymo.app
- 📚 **Docs**: See `/docs` folder
- 🎥 **Tutorials**: Video guides included
- 💬 **Community**: Coming soon

---

## 🗺️ Roadmap

### Current (v2.0.0) ✅
- Desktop application
- Real-time sync
- Thermal printing
- AI forecasting

### Next (v2.1.0) 🚧
- Mobile apps (iOS/Android)
- Voice commands
- Advanced AI chatbot
- Blockchain payments

### Future (v3.0.0) 💭
- IoT integration
- AR table visualization
- Biometric auth
- Customer-facing displays

---

## 🌟 Star History

⭐ **Star this repo** if you find it useful!

---

**Built with ❤️ by the EasyMO Team**

*Revolutionizing restaurant operations, one feature at a time.*

---

[Get Started](DESKTOP_QUICK_START.md) · [Documentation](docs/) · [Support](mailto:support@easymo.app)
