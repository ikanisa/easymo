# 🚀 Quick Start Guide - Bar Manager App v2.0

## 📦 Installation (2 minutes)

```bash
cd bar-manager-app
pnpm install
```

## ⚙️ Configuration (1 minute)

1. Copy environment template:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` with your credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VENUE_NAME=Your Restaurant
```

## 🏃 Run Development Server

### Web Version
```bash
pnpm dev
```
Open [http://localhost:3001](http://localhost:3001)

### Desktop App
```bash
pnpm tauri:dev
```

## 🎯 First Steps

1. **Orders** - View and manage orders (`Cmd+2`)
2. **Tables** - Set up your floor plan (`Cmd+3`)
3. **Menu** - Configure your menu (`Cmd+4`)
4. **Settings** - Configure printers, staff, etc (`Cmd+8`)

## ⌨️ Essential Shortcuts

- `Cmd/Ctrl + K` - Command palette (search everything)
- `Cmd/Ctrl + N` - New order
- `Cmd/Ctrl + F` - Search
- `Escape` - Close dialogs

## 📚 Learn More

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Complete documentation
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - What's built & what's next
- [Architecture](./ARCHITECTURE.md) - System design

## 🆘 Troubleshooting

**Build fails?**
```bash
pnpm install --frozen-lockfile
```

**Tauri won't start?**
- Ensure Rust is installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Check Node version: `node --version` (should be 20+)

**Real-time not working?**
- Verify Supabase credentials in `.env.local`
- Check Supabase dashboard that Realtime is enabled

## 🎉 You're Ready!

The foundation is set. Start building your world-class bar management experience!
