# 🚀 DEPLOYMENT READY - RUN THESE COMMANDS

**Insurance OCR Fix - Final Deployment**  
**Date:** 2025-12-08 16:24 UTC

---

## ⚡ Quick Deploy (Copy & Paste)

### 1️⃣ Git Push

```bash
cd /Users/jeanbosco/workspace/easymo
rm -f .git/index.lock
git add -A
git commit -m "feat: insurance OCR fix - unified-ocr v7 deployed"
git push origin main
```

### 2️⃣ Database Migrations

```bash
cd /Users/jeanbosco/workspace/easymo/supabase
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
supabase link --project-ref lhbowpbcpwoiparwnwgt
supabase db push --project-ref lhbowpbcpwoiparwnwgt
```

### 3️⃣ Verify

```bash
supabase functions list --project-ref lhbowpbcpwoiparwnwgt | grep ocr
# Should show: unified-ocr | ACTIVE | v7
```

---

## ✅ What's Already Done

- ✅ **Code Fixed:** gpt-5 → gpt-4o in unified-ocr
- ✅ **Deployed:** unified-ocr v7 to production (ACTIVE)
- ✅ **Deleted:** Legacy functions (insurance-ocr, ocr-processor, vehicle-ocr)
- ✅ **Committed:** 3 local commits ready to push
- ✅ **Documented:** Complete documentation created

---

## 🧪 Test After Deployment

Send insurance certificate via WhatsApp to test!

Expected: Success + admin notification + 2000 RWF bonus

---

**See MANUAL_DEPLOY_NOW.md for full instructions**
