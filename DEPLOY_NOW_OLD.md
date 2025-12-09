# Quick Deployment Commands - Preferred Suppliers

## ✅ Already Completed

1. **Database**: All tables, functions, and sample data deployed ✅
2. **Git**: Code pushed to GitHub ✅
3. **Documentation**: Complete guides created ✅

## ⏳ To Deploy Now

### Set Environment
```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
cd /Users/jeanbosco/workspace/easymo
```

### Deploy Edge Functions (Choose one)

**Option 1: Deploy All (Fastest)**
```bash
supabase functions deploy --project-ref lhbowpbcpwoiparwnwgt
```

**Option 2: Deploy Critical Only**
```bash
supabase functions deploy wa-agent-call-center --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt
```

**Option 3: Use Script**
```bash
chmod +x deploy-edge-functions.sh
./deploy-edge-functions.sh
```

### Test After Deployment

```bash
# Via WhatsApp
# Message your bot: "I need 10kg of potatoes"

# Expected: Returns Kigali Fresh Market with 10% discount
```

## 📋 Deployment Checklist

- [ ] Set SUPABASE_ACCESS_TOKEN environment variable
- [ ] Run deployment command
- [ ] Wait 5-10 minutes for deployment
- [ ] Test via WhatsApp: "I need 10kg of potatoes"
- [ ] Verify response includes benefits and discount
- [ ] Check function logs for errors

## 🎯 Success Criteria

**AI Response Should Include**:
- 🏆 "RECOMMENDED (EasyMO Partner)"
- Business name: "Kigali Fresh Market"
- Distance: "0.0km away"
- ✅ "10% discount for EasyMO users"
- ✅ "Free delivery over 5,000 RWF"
- Price calculation: "800 RWF/kg → 8,000 RWF for 10kg"
- With discount: "7,200 RWF"

## 📚 Full Documentation

- `EDGE_FUNCTIONS_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `DEPLOYMENT_SUCCESS_PREFERRED_SUPPLIERS.md` - Database deployment report
- `PREFERRED_SUPPLIERS_README.md` - Feature documentation

---

**Time Required**: 15-20 minutes total  
**Difficulty**: Easy (just run commands)  
**Status**: Ready to deploy
