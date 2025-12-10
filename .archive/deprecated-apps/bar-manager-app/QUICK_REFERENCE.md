# 🚀 Bar Manager - Quick Reference Card

## 📦 Installation & Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with Supabase credentials

# 3. Create directories
chmod +x setup-directories.sh && ./setup-directories.sh

# 4. Check status
chmod +x check-status.sh && ./check-status.sh

# 5. Start development
pnpm dev              # Web app (localhost:3001)
pnpm tauri dev        # Desktop app
```

## 🎨 Design System Quick Access

### Colors
```typescript
import { colors } from '@/lib/design-tokens';

colors.brand.primary     // #f9a825 (amber)
colors.status.success    // #10b981 (green)
colors.order.preparing   // #f59e0b (amber)
colors.table.occupied    // #f59e0b (amber)
```

### Utilities
```typescript
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/format-utils';

className={cn('base-class', condition && 'conditional-class')}
{formatCurrency(45000, 'RWF')} // "RWF 45,000"
```

## 🎣 Common Hooks

### Orders
```typescript
import { useOrders } from '@/hooks/useOrders';

const { orders, activeOrders, updateOrderStatus, newOrderCount } = useOrders({
  statuses: ['pending', 'confirmed'], // Optional filter
  autoRefresh: 5000, // Auto refresh interval
});

await updateOrderStatus(orderId, 'preparing');
```

### Tables
```typescript
import { useTables } from '@/hooks/useTables';

const { tables, updateTable, createTable, deleteTable } = useTables();

await updateTable(tableId, { status: 'occupied' });
```

### Analytics
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

const { todayStats, isLoading } = useAnalytics();
// todayStats: { revenue, orders, averageOrderValue, ... }
```

### Keyboard Shortcuts
```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

useKeyboardShortcuts({
  'mod+n': () => createOrder(),
  'mod+f': () => focusSearch(),
  'escape': () => closeModal(),
});
```

### Sound Effects
```typescript
import { useSoundEffects } from '@/hooks/useSoundEffects';

const { playSound, enabled, setEnabled } = useSoundEffects();

playSound('newOrder');     // Plays /sounds/new-order.mp3
playSound('orderReady');   // Plays /sounds/order-ready.mp3
```

### Realtime Updates
```typescript
import { useRealtime } from '@/hooks/useRealtime';

useRealtime({
  table: 'orders',
  event: 'INSERT',
  onEvent: (payload) => console.log('New order:', payload),
});
```

## 🧩 Component Patterns

### Basic Component
```typescript
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MyComponent() {
  const [state, setState] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('p-4 rounded-lg', state && 'bg-primary')}
    >
      <Icon className="w-5 h-5" />
      Content
    </motion.div>
  );
}
```

### Data Fetching Component
```typescript
'use client';

import { useOrders } from '@/hooks/useOrders';

export function OrderList() {
  const { orders, isLoading, error } = useOrders();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {orders.map(order => (
        <div key={order.id}>{order.order_number}</div>
      ))}
    </div>
  );
}
```

### With Keyboard Shortcuts
```typescript
'use client';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function MyFeature() {
  const handleSave = () => { /* save logic */ };
  const handleCancel = () => { /* cancel logic */ };

  useKeyboardShortcuts({
    'mod+s': handleSave,
    'escape': handleCancel,
  });

  return <div>...</div>;
}
```

## 📱 Responsive Design

```typescript
// Grid layouts
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">

// Responsive spacing
<div className="p-4 md:p-6 lg:p-8">

// Hide/show based on breakpoint
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

## 🎭 Animations

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
/>

// Slide from right
<motion.div
  initial={{ x: 100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: 100, opacity: 0 }}
/>

// List animations
<AnimatePresence mode="popLayout">
  {items.map(item => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
    >
      {item.name}
    </motion.div>
  ))}
</AnimatePresence>
```

## 🗄️ Supabase Queries

```typescript
import { useSupabase } from '@/lib/supabase/client';

const supabase = useSupabase();

// Select
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// Insert
const { data, error } = await supabase
  .from('orders')
  .insert({ order_number: '1234', ... })
  .select()
  .single();

// Update
const { data, error } = await supabase
  .from('orders')
  .update({ status: 'preparing' })
  .eq('id', orderId)
  .select()
  .single();

// Realtime subscription
const channel = supabase
  .channel('orders-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
  }, (payload) => {
    console.log('Change:', payload);
  })
  .subscribe();
```

## 🖨️ Printing

```typescript
import { usePrinter } from '@/hooks/usePrinter';

const { printKitchenTicket, printReceipt } = usePrinter();

// Print kitchen ticket
await printKitchenTicket(order);

// Print receipt
await printReceipt(order);
```

## ⌨️ Keyboard Shortcuts Reference

### Navigation
- `⌘/Ctrl + 1-7` - Navigate to sections
- `⌘/Ctrl + K` - Command palette

### Actions
- `⌘/Ctrl + N` - New order
- `⌘/Ctrl + P` - Print
- `⌘/Ctrl + S` - Save
- `⌘/Ctrl + F` - Search

### View
- `⌘/Ctrl + \` - Toggle sidebar
- `⌘/Ctrl + Shift + F` - Fullscreen
- `⌘/Ctrl + Shift + K` - Open KDS

### Quick Actions
- `Space` - Quick action
- `Enter` - Confirm
- `Escape` - Cancel
- `Delete` - Delete

## 📊 Type Definitions

```typescript
// Order types
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
type OrderSource = 'whatsapp' | 'pos' | 'online' | 'phone';
type OrderType = 'dine-in' | 'takeaway' | 'delivery';

// Table types
type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty' | 'blocked';

// Common interfaces
interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  // ... more fields
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
  special_instructions?: string;
}
```

## 🔍 Debugging

```typescript
// Enable React Query DevTools (in development)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />

// Console logging with structure
import { childLogger } from '@easymo/commons';

const log = childLogger({ component: 'OrderQueue' });
log.info({ orderId, status }, 'Order updated');
```

## 📁 File Organization

```
components/
  [feature]/           # Feature folder
    FeatureMain.tsx    # Main component
    FeatureCard.tsx    # Sub-component
    FeatureForm.tsx    # Form component
    index.ts           # Export barrel

hooks/
  use[Feature].ts      # Custom hooks

lib/
  [feature]/           # Feature utilities
    index.ts
    utils.ts
```

## 🚀 Performance Tips

```typescript
// Memoize expensive calculations
const sortedOrders = useMemo(
  () => orders.sort((a, b) => ...),
  [orders]
);

// Memoize callbacks
const handleClick = useCallback(() => {
  // handler
}, [dependency]);

// Virtual scrolling for long lists
import { useVirtualizer } from '@tanstack/react-virtual';

// Code splitting
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>,
});
```

## 📦 Common Imports

```typescript
// React
import { useState, useEffect, useCallback, useMemo } from 'react';

// Next.js
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

// Animations
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import { Icon } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-utils';

// Hooks
import { useOrders } from '@/hooks/useOrders';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// UI Components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
```

## 🎯 Priority Component List

1. ✅ Design system - DONE
2. ✅ Hooks - DONE
3. ✅ Base UI - DONE
4. ❌ Command Center - **START HERE**
5. ❌ Kitchen Display - High priority
6. ❌ Floor Plan Editor - High priority
7. ❌ Menu Editor - Medium priority
8. ❌ Analytics Dashboard - Medium priority

## 📚 Documentation Links

- [Implementation Guide](./WORLD_CLASS_IMPLEMENTATION_GUIDE.md)
- [Complete README](./README_DESKTOP_COMPLETE.md)
- [Status Report](./IMPLEMENTATION_STATUS_COMPLETE.md)
- [Design Tokens](./lib/design-tokens.ts)

---

**Quick Commands:**
```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm type-check   # Type checking
pnpm tauri dev    # Desktop app
./check-status.sh # Check implementation status
```

---

*Keep this card handy while developing! 📌*
