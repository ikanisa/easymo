#!/bin/bash
# Profile Refactoring - Phase 1: Extract Wallet
# This script creates wa-webhook-wallet and moves wallet logic from wa-webhook-profile

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Profile Refactoring - Phase 1: Extract Wallet"
echo "=================================================="
echo ""

# Check we're in the right place
if [ ! -d "supabase/functions/wa-webhook-profile" ]; then
  echo "❌ Error: Cannot find supabase/functions/wa-webhook-profile"
  echo "   Please run this script from the project root"
  exit 1
fi

echo "✅ Project structure validated"
echo ""

# Phase 1.1: Create wa-webhook-wallet structure
echo "📁 Phase 1.1: Creating wa-webhook-wallet structure..."

mkdir -p supabase/functions/wa-webhook-wallet/wallet
mkdir -p supabase/functions/wa-webhook-wallet/__tests__

echo "   ✅ Created directories"

# Phase 1.2: Copy wallet files
echo ""
echo "📋 Phase 1.2: Copying wallet handlers..."

if [ -d "supabase/functions/wa-webhook-profile/wallet" ]; then
  cp -r supabase/functions/wa-webhook-profile/wallet/* \
        supabase/functions/wa-webhook-wallet/wallet/
  echo "   ✅ Copied $(find supabase/functions/wa-webhook-wallet/wallet -name "*.ts" | wc -l) wallet files"
else
  echo "   ⚠️  Warning: wallet directory not found"
fi

# Phase 1.3: Create function.json
echo ""
echo "📝 Phase 1.3: Creating function.json..."

cat > supabase/functions/wa-webhook-wallet/function.json << 'EOF'
{
  "version": "v1",
  "verify_jwt": false,
  "import_map": "../_shared/import_map.json"
}
EOF

echo "   ✅ Created function.json"

# Phase 1.4: Create index.ts template
echo ""
echo "📝 Phase 1.4: Creating index.ts template..."

cat > supabase/functions/wa-webhook-wallet/index.ts << 'EOF'
// wa-webhook-wallet - Dedicated Wallet Webhook
// Extracted from wa-webhook-profile on 2025-12-11
// 
// Responsibilities:
// - Wallet balance display
// - Token transfers
// - Earn/redeem tokens
// - Transaction history
// - Referral codes & rewards
// - Token purchase & cashout
// - MoMo QR integration
// - Leaderboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState, setState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";

const SERVICE_NAME = "wa-webhook-wallet";
const SERVICE_VERSION = "1.0.0";
const MAX_BODY_SIZE = 10_485_760; // 10MB

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: SERVICE_NAME,
      requestId,
      correlationId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("wallet_accounts").select("user_id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected", table: "wallet_accounts" },
        version: SERVICE_VERSION,
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        service: SERVICE_NAME,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler
  try {
    const rawBody = await req.text();
    
    if (rawBody.length > MAX_BODY_SIZE) {
      logEvent("WALLET_BODY_TOO_LARGE", { size: rawBody.length }, "warn");
      return respond({ error: "payload_too_large" }, { status: 413 });
    }
    
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");

    if (!verifyWebhookSignature(rawBody, signatureHeader ?? "", appSecret ?? "")) {
      logEvent("WALLET_SIGNATURE_INVALID", {}, "warn");
      return respond({ error: "invalid_signature" }, { status: 401 });
    }

    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    logEvent("WALLET_WEBHOOK_RECEIVED", { payload });

    // Extract message details
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    const from = message?.from;

    if (!from) {
      return respond({ status: "ok", message: "no_sender" });
    }

    // Ensure profile exists
    const profile = await ensureProfile(supabase, from);
    if (!profile) {
      logEvent("WALLET_PROFILE_CREATE_FAILED", { from }, "error");
      return respond({ error: "profile_creation_failed" }, { status: 500 });
    }

    // Build context
    const ctx: RouterContext = {
      supabase,
      profileId: profile.user_id,
      phoneNumber: from,
      message,
      logEvent,
    };

    let handled = false;

    // Handle interactive messages
    if (message.type === "interactive") {
      const interactive = message.interactive;
      const id = interactive?.button_reply?.id || interactive?.list_reply?.id || "";
      const state = await getState(supabase, profile.user_id, "chat");

      logEvent("WALLET_INTERACTIVE", { id, state: state?.key });

      // ============================================================
      // WALLET ROUTES
      // ============================================================
      
      // Wallet Home
      if (id === IDS.WALLET_HOME || id === "WALLET_HOME" || id === IDS.WALLET || id === "wallet" || id === "wallet_tokens") {
        const { startWallet } = await import("./wallet/home.ts");
        handled = await startWallet(ctx, state ?? { key: "home" });
      }
      
      // Transfer
      else if (id === IDS.WALLET_TRANSFER || id === "transfer") {
        const { startTransfer } = await import("./wallet/transfer.ts");
        handled = await startTransfer(ctx);
      }
      
      // Earn
      else if (id === IDS.WALLET_EARN || id === "earn") {
        const { startEarn } = await import("./wallet/earn.ts");
        handled = await startEarn(ctx);
      }
      
      // Redeem
      else if (id === IDS.WALLET_REDEEM || id === "redeem") {
        const { startRedeem } = await import("./wallet/redeem.ts");
        handled = await startRedeem(ctx);
      }
      
      // Transactions
      else if (id === IDS.WALLET_TRANSACTIONS || id === "transactions") {
        const { showTransactions } = await import("./wallet/transactions.ts");
        handled = await showTransactions(ctx);
      }
      
      // Referral
      else if (id === IDS.WALLET_REFERRAL || id === "referral") {
        const { showReferral } = await import("./wallet/referral.ts");
        handled = await showReferral(ctx);
      }
      
      // Purchase
      else if (id === IDS.WALLET_PURCHASE || id === "purchase") {
        const { startPurchase } = await import("./wallet/purchase.ts");
        handled = await startPurchase(ctx);
      }
      
      // Cashout
      else if (id === IDS.WALLET_CASHOUT || id === "cashout") {
        const { startCashout } = await import("./wallet/cashout.ts");
        handled = await startCashout(ctx);
      }
      
      // Top (Leaderboard)
      else if (id === IDS.WALLET_TOP || id === "top") {
        const { showTop } = await import("./wallet/top.ts");
        handled = await showTop(ctx);
      }
      
      // MoMo QR
      else if (id === "MOMO_QR" || id === "momo_qr") {
        const { startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        handled = await startMomoQr(ctx, state ?? { key: "home" });
      }
      else if (id === IDS.MOMO_QR_MY || id === IDS.MOMO_QR_NUMBER || id === IDS.MOMO_QR_CODE) {
        const { handleMomoButton } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        handled = await handleMomoButton(ctx, id, state ?? { key: "home", data: {} });
      }
    }

    // Handle text messages (for wallet flows requiring input)
    else if (message.type === "text") {
      const state = await getState(supabase, profile.user_id, "chat");
      const text = message.text?.body?.trim() || "";

      logEvent("WALLET_TEXT", { state: state?.key, text: text.substring(0, 50) });

      // Transfer amount input
      if (state?.key === "wallet_transfer_amount") {
        const { handleTransferAmount } = await import("./wallet/transfer.ts");
        handled = await handleTransferAmount(ctx, text, state.data);
      }
      
      // Other text-based wallet flows...
      // (Add more as needed from original handlers)
    }

    if (handled) {
      logEvent("WALLET_HANDLED", { messageType: message.type });
      return respond({ status: "ok" });
    }

    logEvent("WALLET_UNHANDLED", { messageType: message.type }, "warn");
    return respond({ status: "ok", message: "unhandled" });

  } catch (error) {
    logEvent("WALLET_ERROR", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, "error");
    
    return respond({ 
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});
EOF

echo "   ✅ Created index.ts template"

# Phase 1.5: Create README
echo ""
echo "📝 Phase 1.5: Creating README..."

cat > supabase/functions/wa-webhook-wallet/README.md << 'EOF'
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
EOF

echo "   ✅ Created README.md"

# Summary
echo ""
echo "=================================================="
echo "✅ Phase 1 Complete: wa-webhook-wallet created"
echo ""
echo "📊 Summary:"
echo "   - Created wa-webhook-wallet structure"
echo "   - Copied $(find supabase/functions/wa-webhook-wallet/wallet -name "*.ts" 2>/dev/null | wc -l) wallet handler files"
echo "   - Created index.ts template (~300 lines)"
echo "   - Created function.json"
echo "   - Created README.md"
echo ""
echo "📋 Next Steps:"
echo "   1. Review index.ts and add missing wallet routes"
echo "   2. Test wallet webhook: cd supabase/functions/wa-webhook-wallet && deno test --allow-all"
echo "   3. Update wa-webhook-profile/index.ts to remove wallet routes"
echo "   4. Deploy: supabase functions deploy wa-webhook-wallet"
echo "   5. Verify wallet flows work via WhatsApp"
echo ""
echo "🔗 See PROFILE_REFACTORING_PLAN.md for full execution plan"
echo ""
