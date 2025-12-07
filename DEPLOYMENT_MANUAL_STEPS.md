# MANUAL DEPLOYMENT STEPS - Run These Commands

**Date**: 2025-12-07  
**Time**: ~15 minutes  
**Status**: Database ✅ | Edge Functions ⏳

---

## Step 1: Open Terminal

Open your terminal application (Terminal.app on Mac, or your preferred terminal)

---

## Step 2: Set Environment Variables

Copy and paste these commands:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
```

---

## Step 3: Navigate to Project

```bash
cd /Users/jeanbosco/workspace/easymo
```

---

## Step 4: Verify Supabase CLI

```bash
supabase --version
```

If you get an error, install it:
```bash
npm install -g supabase
```

---

## Step 5: Deploy Functions (Choose Method)

### Method A: Deploy All at Once (Fastest - Recommended)

```bash
supabase functions deploy --project-ref lhbowpbcpwoiparwnwgt
```

This will deploy all functions. Wait 5-10 minutes.

---

### Method B: Deploy Critical Functions Only (Targeted)

Run these commands one by one:

```bash
# 1. Call Center AGI (most important)
supabase functions deploy wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

# 2. Core WhatsApp webhook
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

# 3. Buy & Sell commerce
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
```

---

### Method C: Use Automated Script

```bash
# Make script executable
chmod +x deploy-suppliers-functions.sh

# Run it
./deploy-suppliers-functions.sh
```

---

## Step 6: Verify Deployment

Check that functions deployed successfully:

```bash
supabase functions list --project-ref lhbowpbcpwoiparwnwgt
```

You should see a list of functions with their deployment status.

---

## Step 7: Test the Feature

### Test A: Database (Already Working)

```bash
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" -c "SELECT business_name, product_name, price_per_unit FROM search_preferred_suppliers('potatoes', -1.9441, 30.0619, 10, 5);"
```

Expected output:
```
    business_name    |   product_name   | price_per_unit 
---------------------+------------------+----------------
 Kigali Fresh Market | Potatoes (Irish) |         800.00
```

### Test B: Via WhatsApp AI Agent

1. Open WhatsApp
2. Message your business number
3. Type: **"I need 10kg of potatoes"**

Expected AI response:
```
🏆 RECOMMENDED (EasyMO Partner):
Kigali Fresh Market - 0.0km away
✅ 10% discount for EasyMO users
✅ Free delivery over 5,000 RWF
💰 800 RWF/kg → 8,000 RWF for 10kg (with discount: 7,200 RWF)

Other options:
(no other suppliers yet)

Would you like me to connect you with Kigali Fresh Market?
```

---

## Step 8: Monitor Logs (Optional)

Watch real-time function logs:

```bash
supabase functions logs wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --tail
```

Press Ctrl+C to stop.

---

## Troubleshooting

### Issue: "Command not found: supabase"

**Solution**: Install Supabase CLI
```bash
npm install -g supabase
```

### Issue: "Invalid access token"

**Solution**: Re-export the token
```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
```

### Issue: "Project not linked"

**Solution**: Link the project
```bash
supabase link --project-ref lhbowpbcpwoiparwnwgt
```

### Issue: Function deployment fails

**Check**:
1. Internet connection stable?
2. Supabase CLI up to date? (`npm update -g supabase`)
3. Project exists? (Check Supabase dashboard)

### Issue: AI doesn't respond with suppliers

**Check**:
1. Edge functions deployed? (`supabase functions list`)
2. Database has data? (Run Test A above)
3. Function logs for errors? (`supabase functions logs ...`)

---

## Expected Timeline

- **Step 1-4**: 2 minutes
- **Step 5 (Method A)**: 8-10 minutes
- **Step 5 (Method B)**: 5-7 minutes
- **Step 6-7**: 3 minutes
- **Total**: 15-20 minutes

---

## Success Checklist

- [ ] Environment variables set
- [ ] Navigated to project directory
- [ ] Supabase CLI installed
- [ ] Functions deployed (no errors)
- [ ] Database test passed (returns Kigali Fresh Market)
- [ ] WhatsApp test passed (AI responds with supplier)
- [ ] Logs show no errors

---

## What Happens During Deployment

1. **Supabase CLI** reads your function code
2. **Bundles** dependencies from `_shared`
3. **Uploads** to Supabase edge network
4. **Activates** new function version
5. **Old version** remains active during transition
6. **Zero downtime** deployment

---

## After Successful Deployment

✅ **Database Layer**: Working (already deployed)
✅ **Edge Functions**: Working (after Step 5)
✅ **Sample Data**: Loaded (Kigali Fresh Market)
✅ **AI Integration**: Active (search_suppliers tool available)

**You can now**:
- Test via WhatsApp
- Add more suppliers via admin panel
- Monitor usage in Supabase dashboard
- Track searches and conversions

---

## Quick Reference Commands

```bash
# Set credentials
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Deploy all
supabase functions deploy --project-ref lhbowpbcpwoiparwnwgt

# List functions
supabase functions list --project-ref lhbowpbcpwoiparwnwgt

# View logs
supabase functions logs wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --tail

# Test database
psql "$DATABASE_URL" -c "SELECT * FROM search_preferred_suppliers('potatoes', -1.9441, 30.0619, 10, 5);"
```

---

**Ready to deploy?** Start with Step 1! 🚀

**Need help?** Check the detailed guide: `EDGE_FUNCTIONS_DEPLOYMENT_GUIDE.md`
