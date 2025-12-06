# 🖥️ My Business Workflow - Phase 3 Implementation Plan

**Phase:** Desktop App Integration  
**Estimated Time:** 4-5 days  
**Status:** 📋 Planned  
**Prerequisites:** ✅ Phase 1 Complete, ⏳ Phase 2 In Progress

---

## 📋 Phase 3 Overview

### Goal
Integrate the existing bar-manager desktop app with WhatsApp workflow, enabling seamless authentication, real-time order notifications, and two-way menu synchronization between WhatsApp and desktop interfaces.

### Key Features
1. ✅ Magic link authentication from WhatsApp
2. ✅ Real-time order notifications (desktop & WhatsApp)
3. ✅ Two-way menu synchronization
4. ✅ Order management workflow
5. ✅ Desktop analytics dashboard

---

## 🗓️ Implementation Roadmap

### Day 1: Authentication System (6-8 hours)

#### Task 1.1: Generate Magic Links from WhatsApp (3 hours)

**File:** `supabase/functions/wa-webhook/domains/vendor/restaurant.ts`

Add new action to restaurant manager:

```typescript
async function sendDesktopAppLink(
  ctx: RouterContext,
  barId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Verify user is bar manager
  const { data: manager } = await ctx.supabase
    .from("bar_managers")
    .select("*")
    .eq("bar_id", barId)
    .eq("user_id", ctx.profileId)
    .eq("is_active", true)
    .single();
  
  if (!manager) {
    await sendText(
      ctx.from,
      "⚠️ You don't have permission to access the desktop app for this restaurant."
    );
    return true;
  }
  
  // Generate OTP-style token (6 digits, 15 min expiry)
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store token in database
  await ctx.supabase
    .from("desktop_auth_tokens")
    .insert({
      token,
      user_id: ctx.profileId,
      bar_id: barId,
      phone_number: ctx.from,
      expires_at: expiresAt.toISOString(),
      used: false,
    });
  
  const desktopUrl = `https://manager.easymo.app/login`;
  
  await sendButtonsMessage(
    ctx,
    `💻 *Desktop App Access*\n\n` +
    `*Login Code:* \`${token}\`\n\n` +
    `*Steps:*\n` +
    `1. Open ${desktopUrl} on your computer\n` +
    `2. Enter code: ${token}\n` +
    `3. Click "Sign In"\n\n` +
    `⏱️ Code expires in 15 minutes`,
    buildButtons(
      { id: IDS.RESTAURANT_MANAGER, title: "← Back to Menu" },
      { id: `REFRESH_DESKTOP_CODE::${barId}`, title: "🔄 Get New Code" }
    )
  );
  
  await logStructuredEvent("DESKTOP_AUTH_TOKEN_GENERATED", {
    barId,
    userId: ctx.profileId,
    expiresAt,
  });
  
  return true;
}
```

**Database Migration:**

```sql
-- File: supabase/migrations/YYYYMMDD_desktop_auth_tokens.sql

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  
  -- Token lifecycle
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Session info (filled after use)
  session_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_desktop_tokens_token ON desktop_auth_tokens(token) WHERE NOT used;
CREATE INDEX idx_desktop_tokens_expires ON desktop_auth_tokens(expires_at);
CREATE INDEX idx_desktop_tokens_user ON desktop_auth_tokens(user_id);

-- Cleanup expired tokens (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM desktop_auth_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

**Checklist:**
- [ ] Add sendDesktopAppLink() function
- [ ] Create database migration
- [ ] Add token generation logic
- [ ] Test token expiry
- [ ] Add refresh token flow

---

#### Task 1.2: Desktop App Login Handler (3 hours)

**File:** `bar-manager-app/app/login/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("desktop_auth_tokens")
        .select("*, profiles(phone_number), bars(id, name)")
        .eq("token", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        setError("Invalid or expired code. Please request a new code from WhatsApp.");
        setLoading(false);
        return;
      }

      // 2. Create session
      const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
        email: `${tokenData.phone_number}@easymo.app`,
        password: tokenData.token, // Use token as temporary password
      });

      if (sessionError) {
        // User doesn't exist, create account
        const { data: newUser, error: signUpError } = await supabase.auth.signUp({
          email: `${tokenData.phone_number}@easymo.app`,
          password: tokenData.token,
          options: {
            data: {
              phone: tokenData.phone_number,
              bar_id: tokenData.bar_id,
              role: "bar_manager",
            },
          },
        });

        if (signUpError) throw signUpError;
      }

      // 3. Mark token as used
      await supabase
        .from("desktop_auth_tokens")
        .update({
          used: true,
          used_at: new Date().toISOString(),
          session_id: session?.user?.id || null,
          user_agent: navigator.userAgent,
        })
        .eq("token", code);

      // 4. Store bar context in localStorage
      localStorage.setItem("current_bar_id", tokenData.bar_id);
      localStorage.setItem("current_bar_name", tokenData.bars.name);

      // 5. Redirect to dashboard
      router.push("/dashboard");

    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🍽️ Bar Manager</h1>
          <p className="text-gray-600">Enter your WhatsApp login code</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Login Code
            </label>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              pattern="[0-9]{6}"
              className="text-center text-2xl tracking-widest"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>📱 Get your code from WhatsApp:</p>
          <p className="mt-2">
            Profile → My Businesses → Your Restaurant → Manage Menu → Desktop App
          </p>
        </div>
      </Card>
    </div>
  );
}
```

**Checklist:**
- [ ] Create login page component
- [ ] Add token validation logic
- [ ] Handle account creation
- [ ] Store bar context
- [ ] Test login flow
- [ ] Add error handling

---

### Day 2: Real-time Order Notifications (8-10 hours)

#### Task 2.1: Supabase Realtime Setup (2 hours)

**File:** `bar-manager-app/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

// Client for browser
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Enable realtime for orders table
export async function enableRealtimeForBar(barId: string) {
  const channel = supabase
    .channel(`orders:${barId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `bar_id=eq.${barId}`,
      },
      (payload) => {
        console.log("Order change detected:", payload);
      }
    )
    .subscribe();

  return channel;
}
```

**Database Migration:**

```sql
-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- Grant access to anon role
GRANT SELECT ON orders TO anon;
GRANT SELECT ON order_items TO anon;
GRANT SELECT ON menu_items TO anon;

-- RLS policies must allow real-time access
```

**Checklist:**
- [ ] Configure Supabase client
- [ ] Enable realtime on tables
- [ ] Set up RLS policies
- [ ] Test connection

---

#### Task 2.2: Order Notifications Hook (3 hours)

**File:** `bar-manager-app/hooks/useOrders.ts`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface Order {
  id: string;
  customer_phone: string;
  customer_name?: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered";
  total_amount: number;
  currency: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export function useOrders(barId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;

    // Fetch initial orders
    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`orders:${barId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `bar_id=eq.${barId}`,
        },
        async (payload) => {
          console.log("New order received:", payload);
          
          // Fetch full order with items
          const newOrder = await fetchOrderWithItems(payload.new.id);
          if (newOrder) {
            setOrders((prev) => [newOrder, ...prev]);
            
            // Show desktop notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("New Order! 🔔", {
                body: `Order #${payload.new.id.slice(0, 8)} - ${newOrder.total_amount} ${newOrder.currency}`,
                icon: "/logo.png",
                tag: payload.new.id,
              });
            }
            
            // Show toast
            toast.success(`New order from ${newOrder.customer_phone}`, {
              description: `${newOrder.items.length} items - ${newOrder.total_amount} ${newOrder.currency}`,
              action: {
                label: "View",
                onClick: () => window.location.href = `/orders/${newOrder.id}`,
              },
            });
            
            // Play notification sound
            const audio = new Audio("/sounds/new-order.mp3");
            audio.play().catch(console.error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log("Order updated:", payload);
          setOrders((prev) =>
            prev.map((order) =>
              order.id === payload.new.id
                ? { ...order, ...(payload.new as any) }
                : order
            )
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [barId]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            menu_item_name,
            quantity,
            unit_price,
            subtotal
          )
        `)
        .eq("bar_id", barId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setOrders(data as any);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderWithItems(orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            menu_item_name,
            quantity,
            unit_price,
            subtotal
          )
        `)
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error("Error fetching order:", error);
      return null;
    }
  }

  async function updateOrderStatus(orderId: string, status: Order["status"]) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      // Notify customer via WhatsApp
      await supabase.functions.invoke("notify-customer-order-status", {
        body: { orderId, status },
      });

      toast.success(`Order status updated to: ${status}`);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order status");
    }
  }

  return {
    orders,
    loading,
    updateOrderStatus,
    refetch: fetchOrders,
  };
}
```

**Checklist:**
- [ ] Create useOrders hook
- [ ] Implement realtime subscription
- [ ] Add desktop notifications
- [ ] Add toast notifications
- [ ] Add sound notifications
- [ ] Test with sample orders

---

#### Task 2.3: WhatsApp Customer Notifications (2 hours)

**File:** `supabase/functions/notify-customer-order-status/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { sendWhatsAppMessage } from "../_shared/wa-client.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req: Request) => {
  try {
    const { orderId, status } = await req.json();

    // Get order details
    const { data: order } = await supabase
      .from("orders")
      .select("*, bars(name)")
      .eq("id", orderId)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
      });
    }

    // Prepare status message
    const statusMessages = {
      confirmed: "✅ Your order has been confirmed!",
      preparing: "👨‍🍳 Your order is being prepared.",
      ready: "🎉 Your order is ready for pickup/delivery!",
      delivered: "✅ Order delivered. Bon appétit!",
    };

    const message =
      `🍽️ *${order.bars.name}*\n\n` +
      `${statusMessages[status] || `Order status: ${status}`}\n\n` +
      `Order #${orderId.slice(0, 8)}\n` +
      `Total: ${order.total_amount} ${order.currency}`;

    // Send WhatsApp message
    await sendWhatsAppMessage({
      to: order.customer_phone,
      message,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
```

**Checklist:**
- [ ] Create notification function
- [ ] Add status message templates
- [ ] Test WhatsApp delivery
- [ ] Handle error cases
- [ ] Deploy function

---

### Day 3: Two-Way Menu Sync (6-8 hours)

#### Task 3.1: Menu Management Hook (3 hours)

**File:** `bar-manager-app/hooks/useMenu.ts`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category_name: string;
  is_available: boolean;
  image_url?: string;
  display_order: number;
}

export function useMenu(barId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;

    fetchMenu();

    // Subscribe to realtime menu changes
    const channel = supabase
      .channel(`menu:${barId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log("Menu change detected:", payload);
          
          if (payload.eventType === "INSERT") {
            setMenuItems((prev) => [...prev, payload.new as MenuItem]);
          } else if (payload.eventType === "UPDATE") {
            setMenuItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? (payload.new as MenuItem) : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setMenuItems((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [barId]);

  async function fetchMenu() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("bar_id", barId)
        .order("category_name")
        .order("display_order");

      if (error) throw error;
      setMenuItems(data);
    } catch (error) {
      console.error("Error fetching menu:", error);
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }

  async function addMenuItem(item: Omit<MenuItem, "id">) {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ ...item, bar_id: barId })
        .select()
        .single();

      if (error) throw error;
      
      toast.success(`Added: ${item.name}`);
      return data;
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add menu item");
      throw error;
    }
  }

  async function updateMenuItem(id: string, updates: Partial<MenuItem>) {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Menu item updated");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Failed to update menu item");
      throw error;
    }
  }

  async function deleteMenuItem(id: string) {
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Menu item deleted");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete menu item");
      throw error;
    }
  }

  async function toggleAvailability(id: string, is_available: boolean) {
    await updateMenuItem(id, { is_available });
  }

  return {
    menuItems,
    loading,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    refetch: fetchMenu,
  };
}
```

**Checklist:**
- [ ] Create useMenu hook
- [ ] Implement CRUD operations
- [ ] Add realtime sync
- [ ] Test two-way updates
- [ ] Handle conflicts

---

### Day 4-5: Dashboard & Polish (8-10 hours)

#### Task 4.1: Analytics Dashboard (4 hours)

**File:** `bar-manager-app/app/dashboard/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useMenu } from "@/hooks/useMenu";
import { useOrders } from "@/hooks/useOrders";
import { Card } from "@/components/ui/card";
import { OrderCard } from "@/components/OrderCard";
import { MenuEditor } from "@/components/MenuEditor";

export default function DashboardPage() {
  const barId = localStorage.getItem("current_bar_id")!;
  const barName = localStorage.getItem("current_bar_name");
  
  const { orders, loading: ordersLoading, updateOrderStatus } = useOrders(barId);
  const { menuItems, loading: menuLoading } = useMenu(barId);

  const stats = {
    newOrders: orders.filter((o) => o.status === "pending").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
    totalRevenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total_amount, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          🍽️ {barName || "Bar Manager"}
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-2xl font-bold text-orange-600">
              {stats.newOrders}
            </div>
            <div className="text-sm text-gray-600">New Orders 🔔</div>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.preparing}</div>
            <div className="text-sm text-gray-600">Preparing 👨‍🍳</div>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold text-green-600">
              {stats.ready}
            </div>
            <div className="text-sm text-gray-600">Ready 🎉</div>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold">
              {stats.totalRevenue.toLocaleString()} RWF
            </div>
            <div className="text-sm text-gray-600">Today's Revenue 💰</div>
          </Card>
        </div>

        {/* Recent Orders */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
            {ordersLoading ? (
              <div>Loading orders...</div>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 10).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={updateOrderStatus}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Menu Edit</h2>
            {menuLoading ? (
              <div>Loading menu...</div>
            ) : (
              <MenuEditor menuItems={menuItems.slice(0, 10)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Checklist:**
- [ ] Build dashboard layout
- [ ] Add stats cards
- [ ] Display recent orders
- [ ] Add menu quick edit
- [ ] Test responsiveness

---

#### Task 4.2: Production Deployment (2 hours)

**Deployment Checklist:**

```bash
# 1. Build desktop app
cd bar-manager-app
npm run build

# 2. Deploy to Vercel
vercel --prod

# 3. Deploy edge functions
supabase functions deploy notify-customer-order-status
supabase functions deploy wa-webhook-profile
supabase functions deploy wa-webhook

# 4. Update environment variables
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - Desktop app URL in WhatsApp code generator

# 5. Test production flow
# - Generate code from WhatsApp
# - Login to desktop app
# - Place test order from WhatsApp
# - Verify desktop notification
# - Update order status from desktop
# - Verify WhatsApp notification to customer

# 6. Enable realtime in Supabase dashboard
# Settings → API → Realtime → Enable for tables:
# - orders
# - order_items
# - menu_items
```

---

## 📊 Success Metrics (Phase 3)

### KPIs (Week 1-2)
- [ ] **Desktop Adoption:** 40% of bar managers access desktop app
- [ ] **Order Processing Time:** < 3 minutes from order → confirmed
- [ ] **Real-time Sync Uptime:** 99.9%
- [ ] **Customer Notification Delivery:** > 95%
- [ ] **User Satisfaction:** NPS > 8/10

### Analytics Queries

```sql
-- Desktop app usage
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_logins
FROM desktop_auth_tokens
WHERE used = true
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Order processing times
SELECT 
  DATE(created_at) as date,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) / 60 as avg_minutes,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) / 60 as median_minutes
FROM orders
WHERE status IN ('confirmed', 'preparing', 'ready')
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Menu sync activity
SELECT 
  DATE(updated_at) as date,
  COUNT(*) as menu_changes,
  COUNT(DISTINCT bar_id) as restaurants_updated
FROM menu_items
WHERE updated_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(updated_at)
ORDER BY date DESC;
```

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Desktop notifications not showing | Permission not granted | Request notification permission on login |
| Realtime not working | RLS policies too strict | Update policies to allow realtime access |
| Login code expired | 15 min timeout | Add refresh code button |
| Orders not updating | Subscription not connected | Check Supabase realtime status |
| Desktop app logout loop | Session expired | Implement token refresh |

---

## 🚀 Deployment Summary

**Infrastructure:**
- Desktop app: Vercel/Netlify
- Edge functions: Supabase
- Database: Supabase (with realtime enabled)
- WhatsApp: Meta Business API

**Environment Variables:**
```bash
# Desktop App
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
NEXT_PUBLIC_DESKTOP_APP_URL=https://manager.easymo.app

# Edge Functions
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
WA_ACCESS_TOKEN=EAAx...
GEMINI_API_KEY=AIza...
```

---

## 🎯 Success Criteria

### Phase 3 Complete When:
- [x] ✅ Desktop app deployed to production
- [x] ✅ Magic link authentication working
- [x] ✅ Real-time order notifications (desktop & WhatsApp)
- [x] ✅ Two-way menu sync operational
- [x] ✅ Order status updates notify customers
- [x] ✅ Desktop analytics dashboard live
- [x] ✅ All tests passing
- [x] ✅ Documentation complete

---

**Estimated Timeline:** 4-5 days  
**Risk Level:** Medium-High (realtime, desktop integration)  
**Dependencies:** Phase 1 complete, Desktop app codebase exists  
**ROI:** Very High (full-featured restaurant management system)

---

**Status:** 📋 Planned  
**Prerequisites:** Phase 1 ✅ Complete  
**Next Action:** Complete Phase 2 first, then begin Day 1 of Phase 3
