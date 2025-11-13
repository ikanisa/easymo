# Real Estate PWA

Mobile-first Progressive Web App for the Real Estate AI Agent.

## Features

- 🏠 Property search and shortlist viewing
- 💬 Chat interface with AI agent
- 📱 Mobile-first, responsive design
- 🔄 Offline support with service worker
- 🌐 Multi-language support (EN/FR/ES/DE/PT)
- 🔐 Anonymous authentication
- 🔗 Deep linking from WhatsApp

## Getting Started

### Development

```bash
npm install
npm run dev
```

Visit http://localhost:3002

### Build

```bash
npm run build
npm start
```

## Project Structure

```
real-estate-pwa/
├── app/                    # Next.js app directory
│   ├── [locale]/          # Internationalized routes
│   ├── chat/              # Chat interface
│   ├── shortlist/         # Shortlist viewing
│   └── property/[id]/     # Property details
├── components/
│   ├── chat/              # Chat components
│   ├── property/          # Property components
│   └── ui/                # Shared UI components
├── lib/
│   ├── supabase/          # Supabase client
│   ├── auth/              # Authentication
│   └── api/               # API helpers
├── public/
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker
│   └── icons/             # App icons
└── messages/              # i18n message files
```

## Key Technologies

- **Next.js 15** - React framework
- **Tailwind CSS** - Styling
- **Supabase** - Backend & real-time
- **next-intl** - Internationalization
- **next-pwa** - PWA support

## PWA Features

### Offline Support
- Cached property listings
- Cached chat messages
- Queued messages sent when online
- Offline indicator

### Installation
- Add to home screen prompt
- Standalone app mode
- Custom splash screen

### Push Notifications
- Shortlist ready notifications
- Owner reply notifications
- Viewing reminders

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

## Deployment

Deploy to Netlify, Vercel, or any Node.js hosting:

```bash
npm run build
npm start
```

## Integration with WhatsApp

Users can:
1. Start conversation in WhatsApp
2. Receive deep link to PWA
3. Continue conversation in PWA
4. View shortlist in PWA
5. Return to WhatsApp seamlessly

Deep link format: `https://app.easymo.com/property?conversation=<id>&token=<token>`
