# Bar Manager Desktop App - Quick Implementation Guide

## 🎯 TL;DR - What You Need to Do

You have a **working bar manager desktop app** with:
- ✅ Live order queue
- ✅ Real-time notifications  
- ✅ Order list view
- ✅ Menu list view
- ✅ Promo list view
- ✅ Tauri desktop packaging

### Missing: 5 Key Pages (8 hours total)

---

## 🚀 Execute in This Order

### 1️⃣ HOUR 1-2: Core CRUD Pages

#### A) Order Detail Page (30 min)
```bash
mkdir -p app/orders/\[id\]
```

Create `app/orders/[id]/page.tsx`:
```typescript
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams } from "next/navigation"
import Link from "next/link"

export default function OrderDetailPage() {
  const params = useParams()
  const [order, setOrder] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadOrder() {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", params.id)
        .single()
      
      setOrder(data)
      setIsLoading(false)
    }
    loadOrder()
  }, [params.id, supabase])

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="p-6">
      <Link href="/orders" className="text-blue-600">← Back</Link>
      <h1 className="text-3xl font-bold mt-4">Order #{order.order_code}</h1>
      <div className="mt-6 bg-white p-6 rounded-xl">
        <p><strong>Table:</strong> {order.table_label}</p>
        <p><strong>Status:</strong> {order.status}</p>
        <p><strong>Time:</strong> {new Date(order.created_at).toLocaleString()}</p>
        
        <h2 className="text-xl font-bold mt-6 mb-4">Items</h2>
        <ul>
          {order.order_items?.map((item: any) => (
            <li key={item.id} className="flex justify-between py-2 border-b">
              <span>{item.qty}× {item.item_name}</span>
              <span>{item.price_minor / 100} RWF</span>
            </li>
          ))}
        </ul>
        
        <p className="text-2xl font-bold mt-6">
          Total: {order.total_minor / 100} RWF
        </p>
      </div>
    </div>
  )
}
```

✅ **Test:** Visit `/orders` → click order → see details

---

#### B) Menu Edit Page (30 min)
```bash
mkdir -p app/menu/\[id\]/edit
```

Create `app/menu/[id]/edit/page.tsx`:
```typescript
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"

export default function MenuEditPage() {
  const params = useParams()
  const router = useRouter()
  const [form, setForm] = useState({
    name: "", category: "", price: 0, description: "", is_available: true
  })
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadItem() {
      const { data } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .eq("id", params.id)
        .single()
      
      if (data) setForm(data)
      setIsLoading(false)
    }
    loadItem()
  }, [params.id, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase
      .from("restaurant_menu_items")
      .update(form)
      .eq("id", params.id)
    
    router.push("/menu")
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Edit Menu Item</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-4 py-2 border rounded"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={e => setForm({...form, category: e.target.value})}
            className="w-full px-4 py-2 border rounded"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Price (RWF)</label>
          <input
            type="number"
            value={form.price}
            onChange={e => setForm({...form, price: Number(e.target.value)})}
            className="w-full px-4 py-2 border rounded"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Description</label>
          <textarea
            value={form.description || ""}
            onChange={e => setForm({...form, description: e.target.value})}
            className="w-full px-4 py-2 border rounded"
            rows={3}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={e => setForm({...form, is_available: e.target.checked})}
          />
          <label>Available</label>
        </div>
        
        <button
          type="submit"
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold"
        >
          Save Changes
        </button>
      </form>
    </div>
  )
}
```

✅ **Test:** Click "Edit" on menu item → modify → save → see changes

---

#### C) Menu Add Page (20 min)

Create `app/menu/new/page.tsx` - **Copy edit page, remove useEffect, set empty form**

---

#### D) Promo Creation Page (30 min)

Create `app/promos/new/page.tsx`:
```typescript
"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function NewPromoPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    description: "",
    promo_type: "percentage",
    discount_value: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: "",
    is_active: true
  })
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase
      .from("menu_promos")
      .insert({...form, bar_id: barId})
    
    router.push("/promos")
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Promotion</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Promo Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-4 py-2 border rounded"
            placeholder="e.g., Happy Hour"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            className="w-full px-4 py-2 border rounded"
            placeholder="e.g., 20% off all cocktails"
          />
        </div>
        
        <div>
          <label className="block mb-1">Discount Type</label>
          <select
            value={form.promo_type}
            onChange={e => setForm({...form, promo_type: e.target.value})}
            className="w-full px-4 py-2 border rounded"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed_amount">Fixed Amount</option>
            <option value="happy_hour">Happy Hour</option>
          </select>
        </div>
        
        <div>
          <label className="block mb-1">Discount Value</label>
          <input
            type="number"
            value={form.discount_value}
            onChange={e => setForm({...form, discount_value: Number(e.target.value)})}
            className="w-full px-4 py-2 border rounded"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Valid From</label>
            <input
              type="date"
              value={form.valid_from}
              onChange={e => setForm({...form, valid_from: e.target.value})}
              className="w-full px-4 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Valid Until</label>
            <input
              type="date"
              value={form.valid_until}
              onChange={e => setForm({...form, valid_until: e.target.value})}
              className="w-full px-4 py-2 border rounded"
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="w-full py-3 bg-green-600 text-white rounded-lg font-bold"
        >
          Create Promo
        </button>
      </form>
    </div>
  )
}
```

✅ **Test:** Create promo → see in list → toggle active

---

### 2️⃣ HOUR 3-6: AI Menu Upload (OPTIONAL - Can skip for MVP)

If you want AI features, see `BAR_MANAGER_IMPLEMENTATION_PLAN.md` Phase 2.

---

## ✅ MVP Completion Checklist

After implementing the 4 pages above, you'll have:

- ✅ Dashboard with live orders
- ✅ Order list
- ✅ **Order detail** ← NEW
- ✅ Menu list
- ✅ **Menu add** ← NEW
- ✅ **Menu edit** ← NEW
- ✅ Promo list
- ✅ **Promo create** ← NEW
- ✅ Desktop app (Tauri)
- ✅ Real-time notifications

**That's a complete bar management system!**

---

## 🚀 Launch Commands

### Development
```bash
cd /Users/jeanbosco/workspace/easymo-/bar-manager-final
npm run dev
# Visit http://localhost:3000
```

### Desktop App
```bash
npm run tauri:dev
# Launches as native app
```

### Production Build
```bash
npm run tauri:build
# Creates installer in src-tauri/target/release/
```

---

## 🔧 Environment Setup

Create `.env.local` if missing:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## 📊 Time Estimate

| Task | Time | Priority |
|------|------|----------|
| Order detail page | 30 min | HIGH |
| Menu edit page | 30 min | HIGH |
| Menu add page | 20 min | HIGH |
| Promo create page | 30 min | HIGH |
| Testing & fixes | 30 min | HIGH |
| **MVP Total** | **2.5 hours** | - |
| AI upload (optional) | 4 hours | MEDIUM |
| Polish (optional) | 2 hours | LOW |

---

## 🎉 You're 2.5 Hours from Launch!

The hardest work is done. Just add these 4 pages and you have a production-ready bar manager desktop app.

**Need help?** See `BAR_MANAGER_IMPLEMENTATION_PLAN.md` for detailed code examples.
