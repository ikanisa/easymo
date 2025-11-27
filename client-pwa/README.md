# EasyMO Client PWA

World-class Progressive Web Application for bar and restaurant customers.

## Features

- 📱 Mobile-first, native-feeling UI
- ⚡ Lightning-fast performance
- 🌙 Dark mode optimized for bars
- 🔄 Real-time order tracking
- 💳 MoMo & Revolut payments
- 📡 Offline support
- 🔔 Push notifications

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
pnpm dev

# Open http://localhost:3002
```

## Environment Variables

See `.env.example` for required variables.

**Critical**: Use the provided Supabase URL and anon key (not service role key).

## Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

Or connect your Git repository to Netlify for automatic deployments.

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Supabase (Auth & Database)
- Framer Motion (Animations)
- Zustand (State Management)

## Project Structure

```
client-pwa/
├── app/                # Next.js App Router pages
├── components/         # React components
├── lib/               # Utilities & integrations
├── types/             # TypeScript types
├── public/            # Static assets
└── netlify.toml       # Deployment config
```

## License

Proprietary - EasyMO © 2025
