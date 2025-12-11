# wa-webhook-wallet

**Dedicated Wallet Webhook** - Extracted from wa-webhook-profile on 2025-12-11

## Purpose

Handles all wallet-related WhatsApp interactions:
- 💰 Balance display
- 💸 Token transfers
- ⭐ Earn tokens
- 🎁 Redeem rewards
- 📜 Transaction history
- 👥 Referral codes & rewards
- 💳 Token purchase
- 💵 Cash out
- 📱 MoMo QR integration
- 🏆 Leaderboard

## Architecture

Previously all wallet logic lived in `wa-webhook-profile` (2,260 lines).
Now separated into dedicated service for better maintainability.

## Files

- `index.ts` - Main webhook handler
- `wallet/home.ts` - Wallet home/balance
- `wallet/transfer.ts` - Token transfers
- `wallet/earn.ts` - Earn tokens
- `wallet/redeem.ts` - Redeem rewards
- `wallet/transactions.ts` - History
- `wallet/referral.ts` - Referral system
- `wallet/purchase.ts` - Buy tokens
- `wallet/cashout.ts` - Cash out
- `wallet/top.ts` - Leaderboard

## Database Tables

- `wallet_accounts` - Token balances
- `wallet_transactions` - Transaction history
- `referral_links` - Referral codes
- `referral_applications` - Referral tracking

## Testing

```bash
# Unit tests
deno test --allow-all

# Integration tests
cd ../../..
pnpm test:functions
```

## Deployment

```bash
supabase functions deploy wa-webhook-wallet
```

## Observability

All events logged with structured format:
- `WALLET_WEBHOOK_RECEIVED`
- `WALLET_INTERACTIVE`
- `WALLET_TEXT`
- `WALLET_HANDLED`
- `WALLET_ERROR`

## Configuration

Set in `WEBHOOK_CONFIG.wallet` (if defined), otherwise uses defaults:
- `maxBodySize`: 10MB
- Rate limiting: Handled by wa-webhook-core

## Related Webhooks

- `wa-webhook-profile` - Profile management
- `wa-webhook-core` - Request routing
