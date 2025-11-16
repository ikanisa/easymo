# Waiter AI PWA - Quick Reference

🚀 **Status**: 90% Complete | Production Ready with minor fixes  
📅 **Last Updated**: 2025-11-13

## Quick Setup (5 minutes)

```bash
# 1. Install & build shared packages
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build

# 2. Configure waiter-pwa
cd waiter-pwa
cp .env.example .env.local
# Edit .env.local with Supabase credentials

# 3. Apply database migration
cd ../supabase
supabase db push

# 4. Deploy edge functions
supabase functions deploy waiter-ai-agent
supabase secrets set OPENAI_API_KEY=sk-your-key

# 5. Start dev server
cd ../waiter-pwa
pnpm dev  # http://localhost:3001
```

## Architecture

```
PWA (Next.js 15) → Edge Functions (Deno) → OpenAI GPT-4 + Supabase Postgres
```

## Key Files

| File                                                               | Purpose                        |
| ------------------------------------------------------------------ | ------------------------------ |
| `supabase/functions/waiter-ai-agent/index.ts`                      | Main AI agent (OpenAI + tools) |
| `supabase/migrations/20260413000000_waiter_ai_complete_schema.sql` | Complete schema                |
| `waiter-pwa/app/[locale]/chat/page.tsx`                            | Chat interface                 |
| `waiter-pwa/contexts/ChatContext.tsx`                              | Chat state management          |
| `waiter-pwa/contexts/CartContext.tsx`                              | Cart state management          |

## Environment Variables

```bash
# Client-safe (NEXT_PUBLIC prefix)
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (NO prefix - NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

## Development Commands

```bash
pnpm dev                              # Start dev server
pnpm build                            # Production build
pnpm lint                             # Lint code
supabase functions deploy waiter-ai-agent  # Deploy edge function
supabase functions logs waiter-ai-agent    # View logs
```

## Database Tables

- `waiter_conversations` - Chat sessions
- `waiter_messages` - Chat history
- `menu_items` - Restaurant menu
- `draft_orders` - Shopping cart
- `waiter_reservations` - Table bookings
- `waiter_feedback` - Customer ratings

## AI Agent Tools

1. `search_menu` - Search menu items
2. `add_to_cart` - Add to cart
3. `recommend_wine` - Wine pairings
4. `book_table` - Make reservation
5. `update_order` - Modify order
6. `cancel_order` - Cancel order
7. `submit_feedback` - Rate experience

## API Usage

```typescript
// Start conversation
POST /functions/v1/waiter-ai-agent
{ "action": "start_conversation", "userId": "uuid", "language": "en" }

// Send message (streaming)
POST /functions/v1/waiter-ai-agent
{ "action": "send_message", "conversationId": "uuid", "message": "Show menu" }
```

## Supported Languages

🇬🇧 English | 🇫🇷 French | 🇪🇸 Spanish | 🇵🇹 Portuguese | 🇩🇪 German

## Common Issues

**PWA not installing?** Check HTTPS + manifest.json validity  
**Streaming broken?** Verify OpenAI API key is set  
**Menu not loading?** Check RLS policies + menu_items data  
**Payment failing?** Verify API keys + check logs

## Deployment

```bash
# Edge functions
cd supabase
supabase functions deploy waiter-ai-agent

# PWA to Vercel
cd waiter-pwa
vercel --prod

# Set env vars in Vercel dashboard
```

## Documentation

📖 [Full Implementation Guide](./WAITER_AI_PWA_IMPLEMENTATION_COMPLETE.md)

## Support

💬 Slack: #waiter-ai-support  
📧 Email: dev@easymo.com

---

✅ **Production Ready**: Deploy with confidence after minor PWA optimizations
