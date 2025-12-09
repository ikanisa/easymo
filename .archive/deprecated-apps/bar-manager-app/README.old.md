# EasyMO Bar Manager Desktop App

**AI-Powered Order & Menu Management System**

## 🎯 Features

### ✅ Order Management (Live)
- **Real-time Order Queue** - Live updates via Supabase Realtime
- **One-Click Status Updates** - pending → preparing → ready → served
- **Desktop Notifications** - Sound + system alerts for new orders
- **Time Tracking** - Shows how long orders have been waiting

### 🤖 AI Menu Upload (NEW!)
- **Gemini 2.0 Flash Integration** - Extract menu items from:
  - 📷 **Images** - Photos of menus (handwritten or printed)
  - 📄 **PDFs** - Scanned or digital menu documents
  - 📊 **Excel/CSV** - Spreadsheet imports
  - 📝 **Text** - Copy-pasted menu text
- **Smart Categorization** - Auto-categorizes items (Cocktails, Beers, Food, etc.)
- **Review & Edit** - Approve/modify extracted items before saving
- **Batch Import** - Upload multiple files at once

### 📋 Menu Management
- **Browse by Category** - Filter items by type
- **Quick Toggle** - Enable/disable item availability
- **Manual Add/Edit** - Form-based item management
- **Delete with Confirmation** - Safe item removal

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or pnpm
- Supabase project
- Gemini API key (for AI upload)

### Installation

```bash
# Navigate to bar-manager-app
cd bar-manager-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - GEMINI_API_KEY

# Run development server
npm run dev

# Open http://localhost:3001
```

### Database Setup

The app requires these Supabase tables (already exist in your project):

```sql
-- Orders table
orders (id, bar_id, order_code, status, table_label, total_minor, created_at, updated_at)

-- Order items table
order_items (id, order_id, item_name, qty, price_minor, status)

-- Menu items table
restaurant_menu_items (id, bar_id, name, category, description, price, currency, is_available, ocr_extracted, ocr_confidence)
```

Enable Realtime for the `orders` table in Supabase Dashboard.

### Configuration

Before first use, set your `bar_id` in browser localStorage:

```javascript
localStorage.setItem("bar_id", "your-bar-uuid")
```

## 📁 Project Structure

```
bar-manager-app/
├── app/
│   ├── page.tsx                  # Order queue dashboard
│   ├── menu/
│   │   ├── page.tsx              # Menu list
│   │   └── upload/page.tsx       # AI menu upload
│   └── api/
│       └── menu/
│           └── parse/route.ts    # Gemini parsing API
│
├── components/
│   ├── menu/
│   │   └── MenuReviewTable.tsx   # Review extracted items
│   └── ui/
│       └── FileDropzone.tsx      # Drag & drop upload
│
├── lib/
│   ├── supabase/
│   │   └── client.ts             # Supabase client
│   ├── gemini/
│   │   ├── client.ts             # Gemini API client
│   │   ├── prompts.ts            # Extraction prompts
│   │   └── menu-parser.ts        # Parsing logic
│   └── notifications.ts          # Desktop notifications
│
└── package.json
```

## 🎨 Usage

### Order Management

1. **View Orders** - Dashboard shows all pending/preparing/ready orders
2. **Update Status** - Click status button to move order to next stage
3. **Cancel Order** - Click "Cancel Order" to cancel if needed
4. **Get Notified** - Receive sound + desktop notification for new orders

### AI Menu Upload

1. **Go to Menu → AI Upload**
2. **Drag & Drop Files** - Upload images, PDFs, or spreadsheets
3. **Wait for AI** - Gemini extracts items automatically
4. **Review Items** - Check/edit extracted data
5. **Save Selected** - Import approved items to menu

### Manual Menu Management

1. **Go to Menu → Add Item**
2. **Fill Form** - Name, category, price, description
3. **Save** - Item added to menu
4. **Toggle Availability** - Enable/disable items quickly

## 🖥️ Desktop App (Optional)

To build as a standalone desktop app with Tauri:

```bash
# Install Tauri CLI
npm install -g @tauri-apps/cli

# Build desktop app
npm run tauri:build

# Outputs in src-tauri/target/release/bundle/
# - Windows: .exe, .msi
# - macOS: .app, .dmg
# - Linux: .deb, .AppImage
```

## 🔧 Development

```bash
# Dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Desktop dev
npm run tauri:dev
```

## 🌐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous key |
| `GEMINI_API_KEY` | 🎯 For AI | Google Gemini API key |

## 📊 Tech Stack

- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Styling
- **Supabase** - Backend & Realtime
- **Gemini 2.0 Flash** - AI menu extraction
- **Tauri** (optional) - Desktop app wrapper

## 🎯 Roadmap

- [x] Real-time order queue
- [x] Desktop notifications
- [x] AI menu upload
- [x] Review & edit interface
- [ ] Promo management
- [ ] Happy hour setup
- [ ] Tauri desktop packaging
- [ ] Offline support
- [ ] Print kitchen tickets
- [ ] Order analytics

## 📝 License

Part of the EasyMO platform.

## 🆘 Support

For issues or questions, contact the EasyMO team.
