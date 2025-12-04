# Vehicle Management Flow - Visual Guide

## 🔄 Complete User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER OPENS "MY VEHICLES"                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Has vehicles?       │
              └──────┬────────┬──────┘
                     │ NO     │ YES
                     ▼        ▼
         ┌──────────────┐  ┌──────────────────┐
         │  Empty List  │  │  Vehicle List    │
         │  Message     │  │  with Details    │
         │              │  │                  │
         │ "No vehicles │  │ • RAB 123 A ✅   │
         │  yet. Upload │  │ • RAB 456 B ⚠️   │
         │  insurance"  │  │ • RAB 789 C 🕐   │
         │              │  │                  │
         │ [Add Vehicle]│  │ [Add Vehicle]    │
         └──────┬───────┘  └─────┬────────────┘
                │                │
                │ Tap             │ Tap vehicle
                ▼                ▼
         ┌──────────────┐  ┌──────────────────┐
         │ ADD VEHICLE  │  │ VEHICLE DETAILS  │
         │ INSTRUCTIONS │  │                  │
         │              │  │ Plate: RAB 123 A │
         │ "Send photo/ │  │ Make: Toyota     │
         │  PDF of your │  │ Model: Corolla   │
         │  insurance   │  │ Year: 2020       │
         │  certificate"│  │                  │
         │              │  │ Insurance:       │
         │ [← Cancel]   │  │ Status: ✅ Active│
         └──────┬───────┘  │ Expires: 31/12/25│
                │          │                  │
                │ Upload   │ [Renew] [← Back] │
                │ image/PDF└──────────────────┘
                ▼
         ┌──────────────────┐
         │  PROCESSING      │
         │                  │
         │  ⏳ "Processing  │
         │  your insurance  │
         │  certificate..." │
         └────────┬─────────┘
                  │
        ┌─────────┴──────────┐
        │   OCR EXTRACTION   │
        │                    │
        │  • Plate number    │
        │  • Policy number   │
        │  • Insurer name    │
        │  • Expiry date     │
        │  • Vehicle details │
        └─────────┬──────────┘
                  │
      ┌───────────┴───────────┐
      │ VALIDATION            │
      └─┬────────┬─────────┬──┘
        │        │         │
     SUCCESS  EXPIRED  UNREADABLE
        │        │         │
        ▼        ▼         ▼
┌───────────┐ ┌──────┐  ┌────────────┐
│ SUCCESS   │ │REJECT│  │MANUAL      │
│ MESSAGE   │ │      │  │REVIEW QUEUE│
│           │ │"⚠️   │  │            │
│ ✅ Vehicle│ │Insur │  │"⚠️ Unable  │
│ Added!    │ │ance  │  │to read.    │
│           │ │expired│  │Queued for  │
│ Plate: XX │ │"     │  │review."    │
│ Insurer:XX│ │      │  │            │
│ Expires:XX│ │[Retry│  │[My Vehicles│
│           │ │]     │  │]           │
│[View List]│ └──────┘  └────────────┘
└───────────┘
```

---

## 📱 Screen-by-Screen Breakdown

### Screen 1: Empty Vehicle List
```
╔═══════════════════════════════════════╗
║  🚗 My Vehicles                       ║
╠═══════════════════════════════════════╣
║                                       ║
║  You don't have any registered        ║
║  vehicles yet.                        ║
║                                       ║
║  To add a vehicle, simply send us a   ║
║  photo or PDF of your valid insurance ║
║  certificate (Yellow Card).           ║
║                                       ║
║  We'll automatically extract the      ║
║  vehicle details and register it      ║
║  for you!                             ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  ➕ Add Vehicle                 │  ║
║  └─────────────────────────────────┘  ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Back                         │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 2: Add Vehicle Instructions
```
╔═══════════════════════════════════════╗
║  🚗 Add Vehicle                       ║
╠═══════════════════════════════════════╣
║                                       ║
║  To add your vehicle, please send a   ║
║  photo or PDF of your valid insurance ║
║  certificate (Yellow Card).           ║
║                                       ║
║  📋 The system will automatically     ║
║  extract:                             ║
║  • Vehicle registration plate         ║
║  • Insurance policy number            ║
║  • Insurance company name             ║
║  • Policy expiry date                 ║
║                                       ║
║  ⚠️ Important: Your insurance must be ║
║  valid (not expired).                 ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Cancel                       │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 3: Processing
```
╔═══════════════════════════════════════╗
║  ⏳ Processing your insurance         ║
║     certificate...                    ║
║                                       ║
║  This may take a few seconds.         ║
╚═══════════════════════════════════════╝
```

### Screen 4: Success
```
╔═══════════════════════════════════════╗
║  ✅ Vehicle Added Successfully!       ║
╠═══════════════════════════════════════╣
║                                       ║
║  🚗 Plate Number: RAB 123 A          ║
║  🏢 Insurance Company: SORAS          ║
║  📄 Policy Number: POL-2024-12345     ║
║  📅 Insurance Expires: 31/12/2025     ║
║                                       ║
║  Your vehicle is now registered and   ║
║  ready to use for rides!              ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  📋 View My Vehicles             │  ║
║  └─────────────────────────────────┘  ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Back to Profile              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 5: Vehicle List (with vehicles)
```
╔═══════════════════════════════════════╗
║  🚗 My Vehicles                       ║
║  Choose a vehicle to view             ║
╠═══════════════════════════════════════╣
║                                       ║
║  ✅ RAB 123 A                         ║
║      Toyota Corolla 2020              ║
║  ─────────────────────────────────── ║
║  ⚠️ RAB 456 B                         ║
║      Honda Civic 2018                 ║
║  ─────────────────────────────────── ║
║  🕐 RAB 789 C                         ║
║      Nissan Sentra 2019               ║
║  ─────────────────────────────────── ║
║  ➕ Add New Vehicle                   ║
║      Upload insurance certificate     ║
║  ─────────────────────────────────── ║
║  ← Back to Profile                    ║
║      Return to profile menu           ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 6: Vehicle Details
```
╔═══════════════════════════════════════╗
║  🚗 Vehicle Details                   ║
╠═══════════════════════════════════════╣
║                                       ║
║  📋 Plate: RAB 123 A                 ║
║  🏢 Make: Toyota                      ║
║  🚙 Model: Corolla                    ║
║  📅 Year: 2020                        ║
║  🎨 Color: Silver                     ║
║                                       ║
║  🛡️ Insurance                         ║
║  Status: ✅ Active                    ║
║  Company: SORAS                       ║
║  Policy: POL-2024-12345               ║
║  Expires: 31/12/2025                  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Back                         │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 7: Error - Expired Insurance
```
╔═══════════════════════════════════════╗
║  ⚠️ Insurance certificate is expired! ║
╠═══════════════════════════════════════╣
║                                       ║
║  Plate: RAB 123 A                    ║
║  Expiry Date: 15/01/2024              ║
║                                       ║
║  Please upload a valid (non-expired)  ║
║  insurance certificate to add your    ║
║  vehicle.                             ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  🔄 Upload Valid Certificate    │  ║
║  └─────────────────────────────────┘  ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Back                         │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Screen 8: Error - Unreadable Document
```
╔═══════════════════════════════════════╗
║  ⚠️ Unable to read the document       ║
║     automatically.                    ║
╠═══════════════════════════════════════╣
║                                       ║
║  Your document has been queued for    ║
║  manual review. Our team will process ║
║  it shortly and notify you.           ║
║                                       ║
║  Please ensure:                       ║
║  • The image is clear and well-lit    ║
║  • All text is readable               ║
║  • The document is a valid insurance  ║
║    certificate                        ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  📋 My Vehicles                  │  ║
║  └─────────────────────────────────┘  ║
║  ┌─────────────────────────────────┐  ║
║  │  ← Back                         │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## 🎨 Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Active | Insurance valid, >30 days until expiry |
| ⚠️ | Warning | Insurance expiring soon (≤30 days) OR expired |
| 🕐 | Pending | Insurance verification pending |

---

## 🔐 Security Flow

```
User Upload
    ↓
Profile Verification
    ↓
Media ID Uniqueness Check ←─── Prevents duplicates
    ↓
Create Insurance Lead
    ↓
Download from WhatsApp API ←─── Signed URL with expiry
    ↓
Upload to Supabase Storage ←─── Private bucket, RLS enforced
    ↓
Generate Signed URL (10 min) ←─── Temporary access
    ↓
Send to OCR Function ←─── API key auth
    ↓
Extract & Validate Data
    ↓
Check Insurance Expiry ←─── Business rule validation
    ↓
Upsert Vehicle (RPC) ←─── Security definer, safe upsert
    ↓
Create Ownership ←─── Links user to vehicle
    ↓
Create Certificate Record ←─── Stores insurance details
    ↓
Clear State & Notify User
```

---

## 📊 Data Flow

```
WhatsApp Message
    ↓
wa-webhook-profile function
    ↓
    ├─→ insurance_leads (create record)
    ├─→ insurance_media (store reference)
    ├─→ insurance_media_queue (for async processing)
    ↓
insurance-ocr function
    ↓
OpenAI/Gemini API
    ↓
Normalized Data
    ↓
    ├─→ vehicles (upsert via RPC)
    ├─→ vehicle_ownerships (create via RPC)
    ├─→ driver_insurance_certificates (create record)
    ├─→ insurance_leads (update with OCR results)
    ↓
User Notification
```

---

## 🔄 State Transitions

```
┌──────┐
│ home │ ←──────────────────────────┐
└───┬──┘                            │
    │ User taps "Add Vehicle"       │
    ▼                               │
┌─────────────────────┐             │
│vehicle_add_insurance│             │
└──────┬──────────────┘             │
       │ User uploads document      │
       ▼                            │
   Processing                       │
       │                            │
       ├─→ Success ─────────────────┤
       ├─→ Error ───────────────────┤
       └─→ Manual Review ───────────┘
```

---

## 💡 Key Design Decisions

### 1. **No AI Agent**
- ❌ Don't reference non-existent AI chat agent
- ✅ Direct upload flow is simpler and faster

### 2. **OCR Integration**
- ✅ Reuse existing `insurance-ocr` function
- ✅ Support both OpenAI and Gemini (redundancy)
- ✅ Queue for manual review on failure

### 3. **Database Schema**
- ✅ Use proper normalized tables
- ✅ Separate vehicle from ownership (allows transfers)
- ✅ Link insurance certificates to vehicles

### 4. **User Experience**
- ✅ Clear, actionable messages at every step
- ✅ Validate before creating records
- ✅ Show insurance expiry warnings
- ✅ Provide retry options on errors

### 5. **Security**
- ✅ RLS policies on all tables
- ✅ Profile ID verification required
- ✅ Temporary signed URLs for media
- ✅ Idempotent operations (duplicate detection)

---

## 🎯 Success Indicators

### Immediate
- [ ] No references to "AI Agent"
- [ ] OCR extracts data correctly
- [ ] Expired insurance rejected
- [ ] Clear error messages displayed

### Operational
- [ ] >80% OCR success rate
- [ ] <20% manual review rate
- [ ] <2s average processing time
- [ ] Zero duplicate vehicles

### Business
- [ ] Increased vehicle registrations
- [ ] Reduced admin workload
- [ ] Positive user feedback
- [ ] Compliance with insurance validation

---

**This visual guide provides a clear understanding of the complete vehicle management flow.**
