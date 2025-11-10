# Enable AI Agents - Quick Guide

## ⚠️ Secret Limit Issue

Your Supabase project has **105/100 secrets** (over limit).  
Cannot add new secrets via CLI until some are removed.

## ✅ Solution: Use Supabase Dashboard

### Step 1: Add the Consolidated Flag

1. **Open Supabase Dashboard**  
   URL: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/edge-functions

2. **Click "Add new secret"**

3. **Add this secret:**
   - Name: `FEATURE_AGENT_ALL`
   - Value: `true`

4. **Click "Save"**

This single flag enables ALL AI agents at once!

### Step 2: Redeploy wa-webhook (if needed)

After adding the secret, the edge function should pick it up automatically.  
If not, redeploy:

```bash
cd /Users/jeanbosco/workspace/easymo-
supabase functions deploy wa-webhook
```

Or wait for the next GitHub Actions deploy (happens on every push to main).

---

## 🎯 What This Enables

With `FEATURE_AGENT_ALL=true`, these features activate:

| Feature | What It Does |
|---------|--------------|
| **Nearby Drivers** | AI finds & negotiates with drivers for trips |
| **Pharmacy** | AI searches pharmacies for medications |
| **Property Rental** | AI helps find/list rental properties |
| **Schedule Trip** | AI schedules recurring trips with pattern recognition |
| **Shops** | AI finds general retail shops |
| **Quincaillerie** | AI finds hardware stores |

---

## 🔧 How It Works

The code now checks:
1. Individual flag: `FEATURE_AGENT_NEARBY_DRIVERS`
2. Consolidated flag: `FEATURE_AGENT_ALL` (if flag starts with "agent.")
3. Default: `false`

This means:
- `FEATURE_AGENT_ALL=true` → Enables ALL agent features
- `FEATURE_AGENT_NEARBY_DRIVERS=false` + `FEATURE_AGENT_ALL=true` → Nearby Drivers still **ENABLED**
- Individual flags override the consolidated flag

---

## 📊 Verify It's Working

After enabling, check the Supabase Edge Function logs:

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/wa-webhook/logs

2. Look for these log entries when users interact:
   - `AGENT_REQUEST_ROUTED` - AI agent was called
   - `AGENT_OPTION_SELECTED` - User selected AI result
   - `AGENT_ERROR` - Something went wrong

3. Test flow:
   - Send WhatsApp message to your bot
   - Select "🚖 See Drivers" from menu
   - Should ask for pickup/dropoff locations
   - Should invoke AI agent (check logs)

---

## 🐛 Troubleshooting

**AI not activating?**
```bash
# Check if secret is set
supabase secrets list | grep FEATURE_AGENT_ALL

# Should show:
# FEATURE_AGENT_ALL | [some hash]
```

**Still using traditional flow?**
- Redeploy: `supabase functions deploy wa-webhook`
- Check logs for errors
- Verify edge function `agent-negotiation` exists

**Want to disable a specific agent?**
Add individual flag:
```
FEATURE_AGENT_NEARBY_DRIVERS=false
```
(This overrides FEATURE_AGENT_ALL for that specific agent)

---

## 🧹 Optional: Clean Up Duplicate Secrets

Your project has duplicate WhatsApp secrets that can be removed:

```bash
# Remove old naming convention (keep WHATSAPP_* versions)
supabase secrets unset WA_TOKEN
supabase secrets unset WA_APP_SECRET
supabase secrets unset WA_PHONE_ID
supabase secrets unset WA_VERIFY_TOKEN
supabase secrets unset WA_BOT_NUMBER_E164
supabase secrets unset WA_SUPABASE_SERVICE_ROLE_KEY

# Remove possible duplicates
supabase secrets unset VITE_SUPABASE_URL  # Should use NEXT_PUBLIC_SUPABASE_URL
```

This would free up ~7 secret slots for future use.

---

## 📝 Changes Made

**Commit**: `a83e015` + latest changes
- Added `FEATURE_AGENT_ALL` fallback in `feature-flags.ts`
- AI agents now check consolidated flag
- Maintains individual flag support

**Files Modified**:
- `supabase/functions/_shared/feature-flags.ts`

---

## ✅ Quick Setup

**TL;DR** - Just do this:

1. Go to https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/edge-functions
2. Add secret: `FEATURE_AGENT_ALL` = `true`
3. Save
4. Test: Send WhatsApp message → Select "See Drivers" → Check logs

Done! 🎉
