# 🚀 EasyMO Workflows - Quick Testing Reference

**Status**: ✅ Production Ready  
**Date**: 2025-11-23  
**Commit**: 849afee

---

## 📱 Test Commands (Via WhatsApp)

### 1️⃣ Insurance OCR & AI Agent
```
Send: "I need motor insurance"
→ AI responds with options
→ Upload vehicle document (image)
→ OCR processes automatically
→ Admin receives notification
```

### 2️⃣ Referral System
```
Send: "Wallet"
Select: "💰 Earn tokens"
Choose: "Share via QR Code"
→ Unique code generated
→ QR code sent
→ 10 tokens per referral
```

### 3️⃣ MOMO QR Code
```
Admin panel → "MoMo QR"
Enter: Merchant code or phone
→ USSD QR generated
→ Scan → Opens MTN MoMo
```

### 4️⃣ Wallet Transfers
```
Send: "Wallet"
Select: "💸 Transfer"
Enter: Amount (min 2000)
→ Transfer executes
→ Recipient notified
```

### 5️⃣ Rides with Location
```
Send: "Rides"
Share: Your location
Select: Vehicle type
→ Location cached 30 min
→ Nearby drivers shown (10km)
```

---

## 📊 Monitor Live

```bash
# All interactions
supabase functions logs wa-webhook --project-ref lhbowpbcpwoiparwnwgt --tail

# Insurance OCR
supabase functions logs insurance-ocr --project-ref lhbowpbcpwoiparwnwgt --tail

# Wallet ops
supabase functions logs wa-webhook-wallet --project-ref lhbowpbcpwoiparwnwgt --tail

# Rides
supabase functions logs wa-webhook-mobility --project-ref lhbowpbcpwoiparwnwgt --tail
```

---

## ✅ Verification Checklist

- [x] API keys configured (OPENAI, GEMINI)
- [x] Database migrations applied
- [x] Edge functions deployed
- [x] Documentation committed
- [ ] Insurance tested via WhatsApp
- [ ] Referral tested via WhatsApp
- [ ] MOMO QR tested (admin)
- [ ] Wallet tested via WhatsApp
- [ ] Rides tested via WhatsApp

---

## 📚 Full Documentation

- **START_HERE_WORKFLOWS_ANALYSIS.md** - Navigation
- **DEPLOYMENT_COMPLETE_REPORT_2025-11-23.md** - Full testing guide
- **DEEP_REPOSITORY_ANALYSIS_2025-11-23.md** - Technical details

---

**Project**: https://lhbowpbcpwoiparwnwgt.supabase.co  
**Repo**: https://github.com/ikanisa/easymo-  
**Ready**: ✅ Begin testing now!
