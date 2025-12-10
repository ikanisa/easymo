# 🚀 Quick Reference - Bar Manager Desktop App

## ⚡ Common Commands

```bash
# Development
pnpm dev                  # Start Next.js dev server (port 3001)
pnpm tauri:dev            # Start Tauri desktop app
pnpm type-check           # TypeScript validation
pnpm lint                 # ESLint check

# Build
pnpm build                # Production build
pnpm tauri:build          # Build desktop app
pnpm tauri:build:all      # Build for all platforms

# Testing
pnpm test                 # Vitest unit tests
pnpm test:e2e             # Playwright E2E tests
```

---

## ⌨️ Keyboard Shortcuts

### Navigation
- `⌘/Ctrl + 1-7` - Navigate to sections (Dashboard, Orders, Tables, etc.)
- `⌘/Ctrl + K` - Open command palette
- `⌘/Ctrl + F` - Focus search
- `⌘/Ctrl + \` - Toggle sidebar
- `Escape` - Close/cancel

### Actions
- `⌘/Ctrl + N` - New order
- `⌘/Ctrl + P` - Print
- `⌘/Ctrl + S` - Save
- `⌘/Ctrl + Shift + F` - Fullscreen
- `⌘/Ctrl + Shift + K` - Open KDS window

### Quick Actions
- `Space` - Quick action on selected item
- `Enter` - Confirm/open
- `Delete` - Delete selected
- `1-4` - Filter by status (in order queue)

---

## 🎨 Using Design Tokens

```typescript
import { colors, typography, spacing, animation } from '@/lib/design-tokens';

// Colors
<div className="bg-primary">         // Amber #f9a825
<div className="text-success">       // Green #10b981
<div className="border-order-new">   // Blue #3b82f6

// Or use CSS custom properties
style={{ backgroundColor: colors.brand.primary }}
style={{ color: colors.status.success }}
```

---

## 🪝 Essential Hooks

### Keyboard Shortcuts

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

useKeyboardShortcuts({
  'mod+s': () => save(),
  'mod+n': () => createNew(),
  'escape': () => close(),
});
```

### Sound Effects

```typescript
import { useSoundEffects } from '@/hooks/useSoundEffects';

const { playSound, enabled, setEnabled } = useSoundEffects();

// Play sound
playSound('newOrder');
playSound('success');
playSound('alert');

// Toggle sound
setEnabled(false);
```

### Multi-Window

```typescript
import { useMultiWindow } from '@/hooks/useMultiWindow';

const { openKDS, openWindow, closeWindow } = useMultiWindow();

// Open KDS
const kdsWindow = openKDS();

// Custom window
openWindow({
  id: 'reports',
  title: 'Reports Dashboard',
  url: '/reports',
  width: 1400,
  height: 900,
});
```

### Real-time Updates

```typescript
import { useRealtime } from '@/hooks/useRealtime';

useRealtime({
  table: 'orders',
  event: 'INSERT',
  onInsert: (order) => {
    playSound('newOrder');
    addToQueue(order);
  },
});
```

---

## 🖨️ Printer Integration

```typescript
import { usePrinter } from '@/lib/printer/manager';

const { printReceipt, printKitchenTicket } = usePrinter();

// Print receipt
await printReceipt(order);

// Print kitchen ticket
await printKitchenTicket(order);
```

### Custom Printing

```typescript
import { ReceiptBuilder, printerManager } from '@/lib/printer/manager';

const printer = printerManager.getDefaultPrinter('receipt');
const builder = new ReceiptBuilder(printer);

builder
  .init()
  .center()
  .bold()
  .doubleSize()
  .text('CUSTOM RECEIPT')
  .normal()
  .separator()
  .left()
  .text('Item 1: $10.00')
  .text('Item 2: $15.00')
  .separator()
  .right()
  .bold()
  .text('Total: $25.00')
  .newLine(3)
  .cut();

const data = builder.build();
await printerManager.print(printer, data);
```

---

## 📊 Component Patterns

### Order Card

```typescript
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function OrderCard({ order }) {
  const isDelayed = Date.now() - new Date(order.created_at) > 15 * 60 * 1000;
  
  return (
    <div className={cn(
      'p-4 rounded-xl border',
      isDelayed && 'border-red-500 animate-pulse'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">#{order.order_number}</span>
        <Badge status={order.status} />
      </div>
      
      <div className="mt-2 text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
      </div>
      
      {order.items.map(item => (
        <div key={item.id} className="flex justify-between">
          <span>{item.quantity}x {item.name}</span>
          <span>{formatCurrency(item.price * item.quantity)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Status Badge

```typescript
import { colors } from '@/lib/design-tokens';

const STATUS_CONFIG = {
  new: { label: 'New', color: colors.order.new },
  preparing: { label: 'Preparing', color: colors.order.preparing },
  ready: { label: 'Ready', color: colors.order.ready },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
```

---

## 🗄️ Data Fetching

### Supabase Queries

```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Fetch orders
const { data: orders } = await supabase
  .from('orders')
  .select('*, items(*), customer(*)')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// Update order
await supabase
  .from('orders')
  .update({ status: 'preparing' })
  .eq('id', orderId);

// Real-time subscription
const channel = supabase
  .channel('orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
  }, (payload) => {
    console.log('Order updated:', payload);
  })
  .subscribe();
```

### TanStack Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['orders', status],
  queryFn: () => fetchOrders(status),
});

// Mutate data
const mutation = useMutation({
  mutationFn: updateOrder,
  onSuccess: () => {
    queryClient.invalidateQueries(['orders']);
  },
});
```

---

## 🎯 State Management (Zustand)

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface OrderStore {
  orders: Order[];
  selectedId: string | null;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  selectOrder: (id: string | null) => void;
}

export const useOrderStore = create<OrderStore>()(
  immer((set) => ({
    orders: [],
    selectedId: null,
    
    addOrder: (order) =>
      set((state) => {
        state.orders.push(order);
      }),
    
    updateOrder: (id, updates) =>
      set((state) => {
        const order = state.orders.find((o) => o.id === id);
        if (order) Object.assign(order, updates);
      }),
    
    selectOrder: (id) =>
      set((state) => {
        state.selectedId = id;
      }),
  }))
);
```

---

## 🎨 Styling Utilities

### Tailwind + CVA

```typescript
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'rounded-lg font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'hover:bg-muted',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

function Button({ variant, size, className, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

---

## 🔔 Notifications

### Toast Notifications

```typescript
import { toast } from '@/components/ui/Toast';

// Success
toast.success('Order confirmed!');

// Error
toast.error('Failed to save order');

// Info with action
toast.info('Low stock alert', {
  action: {
    label: 'View',
    onClick: () => navigate('/inventory'),
  },
});
```

### Desktop Notifications

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

await sendNotification({
  title: 'New Order',
  body: `Order #${order.number} from Table ${order.table}`,
  icon: '/icon.png',
});
```

---

## 📱 Responsive Breakpoints

```typescript
// Tailwind breakpoints
sm: 640px   // Small tablets
md: 768px   // Tablets
lg: 1024px  // Small desktops
xl: 1280px  // Desktops
2xl: 1536px // Large desktops

// Usage
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

---

## 🐛 Debugging

### React DevTools
- Install React DevTools extension
- Use Component tab to inspect state
- Use Profiler for performance

### Supabase Logs
```typescript
// Enable query logging
const supabase = createClient({
  db: { schema: 'public' },
  global: { headers: { 'x-my-custom-header': 'my-app-name' } },
  debug: true, // Enable debug mode
});
```

### Browser Console
```javascript
// Check real-time connection
console.log(supabase.getChannels());

// Inspect Zustand store
window.orderStore = useOrderStore.getState();
```

---

## 📚 File Structure

```
bar-manager-app/
├── app/              # Next.js pages
├── components/       # React components
├── hooks/            # Custom hooks
├── lib/              # Utilities & services
│   ├── printer/      # Printer management
│   ├── supabase/     # Database client
│   └── ai/           # AI integrations
├── stores/           # Zustand stores
└── public/           # Static assets
    └── sounds/       # Audio files
```

---

## 🔗 Useful Links

- [Tauri Docs](https://v2.tauri.app/)
- [Next.js 15](https://nextjs.org/docs)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query)

---

**Last Updated:** 2025-11-27  
**Version:** 2.0.0
