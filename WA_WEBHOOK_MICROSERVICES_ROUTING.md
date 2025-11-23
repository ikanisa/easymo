# WhatsApp Webhook Microservices - Correct Routing Guide

**Date:** 2025-11-23  
**Issue:** All deployments going to `wa-webhook` monolith instead of specialized microservices

---

## 🎯 MICROSERVICE ARCHITECTURE

### Available Microservices

| Microservice | Purpose | Imports From | Status |
|--------------|---------|--------------|--------|
| `wa-webhook` | **MAIN MONOLITH** - Shared library + fallback handler | N/A | ✅ ACTIVE |
| `wa-webhook-core` | Router/dispatcher to other services | wa-webhook/ | ✅ ACTIVE |
| `wa-webhook-wallet` | **Wallet & Tokens** operations | wa-webhook/domains/wallet/ | ✅ DEPLOYED v61 |
| `wa-webhook-insurance` | Insurance workflows | wa-webhook/domains/insurance/ | ⏳ CHECK |
| `wa-webhook-mobility` | Rides, nearby, schedule | Own handlers | ✅ ACTIVE |
| `wa-webhook-jobs` | Job board | Own handlers | ✅ ACTIVE |
| `wa-webhook-property` | Property rentals | Own handlers | ✅ ACTIVE |
| `wa-webhook-ai-agents` | AI agent orchestration | Own logic | ✅ ACTIVE |
| `wa-webhook-marketplace` | Marketplace features | wa-webhook/ | ✅ ACTIVE |

---

## 📋 ROUTING RULES

### Rule 1: Shared Library Pattern
**Microservices that import from `wa-webhook/`:**
- `wa-webhook-wallet` imports from `wa-webhook/domains/wallet/`
- `wa-webhook-insurance` imports from `wa-webhook/domains/insurance/`
- `wa-webhook-marketplace` imports from `wa-webhook/`
- `wa-webhook-core` imports routing logic

**Deployment Strategy:**
1. Edit code in `wa-webhook/domains/X/`
2. Deploy `wa-webhook` (updates shared library)
3. Deploy `wa-webhook-X` (picks up changes)

### Rule 2: Standalone Pattern
**Microservices with own code:**
- `wa-webhook-mobility` - Has own `handlers/`, `flows/`, `i18n/`
- `wa-webhook-jobs` - Standalone
- `wa-webhook-property` - Standalone
- `wa-webhook-ai-agents` - Standalone

**Deployment Strategy:**
1. Edit code directly in `wa-webhook-X/` folder
2. Deploy only `wa-webhook-X`

---

## 🔄 PAST 48 HOURS DEPLOYMENTS (Nov 22-24)

### What Was Deployed (Incorrectly)

#### 1. **Share easyMO (Referrals)**
- **Code:** `wa-webhook/utils/share.ts`, `wa-webhook/router/interactive_button.ts`
- **Used By:** `wa-webhook-wallet` (earn tokens feature)
- **Deployed To:** ✅ wa-webhook v535-547
- **SHOULD ALSO DEPLOY:** ✅ wa-webhook-wallet ✅ (NOW DONE v61)

#### 2. **Vendor Menu (Restaurant)**
- **Code:** `wa-webhook/flows/vendor/menu.ts`
- **Used By:** `wa-webhook` (main monolith)
- **Deployed To:** ✅ wa-webhook v535-547
- **Correct:** ✅ (no microservice for vendor)

#### 3. **Insurance Routing**
- **Code:** `wa-webhook/domains/insurance/`, `wa-webhook/router/media.ts`
- **Used By:** `wa-webhook-insurance` microservice
- **Deployed To:** ✅ wa-webhook v531-547
- **SHOULD ALSO DEPLOY:** ⏳ wa-webhook-insurance (PENDING)

#### 4. **Wallet & Tokens**
- **Code:** `wa-webhook/domains/wallet/*` (home, earn, transfer, redeem, allocate)
- **Used By:** `wa-webhook-wallet` microservice
- **Deployed To:** ✅ wa-webhook v547
- **SHOULD ALSO DEPLOY:** ✅ wa-webhook-wallet ✅ (NOW DONE v61)

#### 5. **Rides System**
- **Code:** `wa-webhook-mobility/` (own folder)
- **Used By:** `wa-webhook-mobility` microservice
- **Deployed To:** ✅ wa-webhook-mobility v128-131
- **Correct:** ✅ (standalone, correct deployment)

---

## ✅ CORRECTIVE ACTIONS TAKEN

### 1. Wallet Microservice
```bash
# Updated shared library
pnpm run functions:deploy:wa-main  # wa-webhook v547

# Deployed wallet microservice (picks up changes)
supabase functions deploy wa-webhook-wallet  # v61
```

**Status:** ✅ COMPLETE

---

## ⏳ PENDING DEPLOYMENTS

### 2. Insurance Microservice
**Changes:**
- Insurance routing fixes
- OCR processor updates
- Vendor menu skip logic

**Action Required:**
```bash
supabase functions deploy wa-webhook-insurance
```

**Files to Verify:**
- `wa-webhook-insurance/index.ts` - Check if it imports from `wa-webhook/domains/insurance/`

---

## 📝 DEPLOYMENT CHECKLIST (Going Forward)

### When Editing `wa-webhook/domains/wallet/*`
```bash
# 1. Deploy shared library
pnpm run functions:deploy:wa-main

# 2. Deploy wallet microservice
supabase functions deploy wa-webhook-wallet
```

### When Editing `wa-webhook/domains/insurance/*`
```bash
# 1. Deploy shared library
pnpm run functions:deploy:wa-main

# 2. Deploy insurance microservice
supabase functions deploy wa-webhook-insurance
```

### When Editing `wa-webhook-mobility/*` (standalone)
```bash
# Deploy ONLY mobility microservice
supabase functions deploy wa-webhook-mobility
```

### When Editing `wa-webhook/router/*` or `wa-webhook/utils/*`
```bash
# Deploy main + all microservices that import from wa-webhook/
supabase functions deploy wa-webhook wa-webhook-wallet wa-webhook-insurance wa-webhook-marketplace
```

---

## 🎯 CURRENT DEPLOYMENT STATUS

### ✅ Correctly Deployed
- ✅ `wa-webhook` v547 - Main monolith/shared library
- ✅ `wa-webhook-wallet` v61 - Wallet microservice (just deployed)
- ✅ `wa-webhook-mobility` v131 - Rides microservice
- ✅ `wa-webhook-jobs` v133 - Jobs microservice
- ✅ `wa-webhook-property` v112 - Property microservice

### ⏳ Needs Deployment
- ⏳ `wa-webhook-insurance` - Insurance microservice (needs redeploy to pick up fixes)
- ⏳ `wa-webhook-core` - Router (if routing logic changed)
- ⏳ `wa-webhook-ai-agents` - AI agents (if agent logic changed)
- ⏳ `wa-webhook-marketplace` - Marketplace (if marketplace logic changed)

---

## 🔍 HOW TO CHECK MICROSERVICE DEPENDENCIES

### Check if Microservice Imports from wa-webhook/
```bash
# Example: Check wa-webhook-insurance
grep -r "from.*wa-webhook/" supabase/functions/wa-webhook-insurance/index.ts
```

**If YES:** Deploy both `wa-webhook` AND `wa-webhook-insurance`  
**If NO:** Deploy only `wa-webhook-insurance`

---

## 📊 OPTIMAL DEPLOYMENT COMMANDS

### Single Feature Deployments

```bash
# Wallet feature
supabase functions deploy wa-webhook wa-webhook-wallet

# Insurance feature  
supabase functions deploy wa-webhook wa-webhook-insurance

# Rides feature
supabase functions deploy wa-webhook-mobility

# Jobs feature
supabase functions deploy wa-webhook-jobs
```

### Full System Deployment (Changed _shared/)

```bash
# Deploy all microservices
supabase functions deploy \
  wa-webhook \
  wa-webhook-core \
  wa-webhook-wallet \
  wa-webhook-insurance \
  wa-webhook-mobility \
  wa-webhook-jobs \
  wa-webhook-property \
  wa-webhook-ai-agents \
  wa-webhook-marketplace
```

---

## 🚀 RECOMMENDED PACKAGE.JSON UPDATES

```json
{
  "scripts": {
    "deploy:wa-main": "supabase functions deploy wa-webhook",
    "deploy:wa-wallet": "supabase functions deploy wa-webhook wa-webhook-wallet",
    "deploy:wa-insurance": "supabase functions deploy wa-webhook wa-webhook-insurance",
    "deploy:wa-mobility": "supabase functions deploy wa-webhook-mobility",
    "deploy:wa-jobs": "supabase functions deploy wa-webhook-jobs",
    "deploy:wa-property": "supabase functions deploy wa-webhook-property",
    "deploy:wa-all": "supabase functions deploy wa-webhook wa-webhook-core wa-webhook-wallet wa-webhook-insurance wa-webhook-mobility wa-webhook-jobs wa-webhook-property wa-webhook-ai-agents wa-webhook-marketplace"
  }
}
```

---

## ✅ SUMMARY

**Problem:** All changes deployed to `wa-webhook` monolith only  
**Impact:** Microservices didn't receive updates  
**Solution:** Deploy to both shared library AND consuming microservices  

**Completed:**
- ✅ `wa-webhook-wallet` redeployed v61

**Pending:**
- ⏳ `wa-webhook-insurance` needs deployment
- ⏳ Verify other microservices

**Going Forward:**
- Use new deployment commands
- Always deploy microservice after updating shared code
- Check import patterns before deploying

