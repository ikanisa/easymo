'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChefHat, CheckCircle2, Volume2, VolumeX, Maximize, RefreshCw, ArrowLeft } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const KDS_CONFIG = {
  warningThreshold: 10 * 60 * 1000,
  criticalThreshold: 15 * 60 * 1000,
};

function KDSTicket({ order, onBump, onRecall }: any) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(order.created_at).getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const isWarning = elapsed > KDS_CONFIG.warningThreshold;
  const isCritical = elapsed > KDS_CONFIG.criticalThreshold;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'flex flex-col rounded-xl border-2 overflow-hidden',
        isCritical && 'border-red-500 bg-red-500/10 animate-pulse',
        isWarning && !isCritical && 'border-amber-500 bg-amber-500/10',
        !isWarning && !isCritical && 'border-zinc-700 bg-zinc-900'
      )}
    >
      <div className={cn('flex items-center justify-between px-4 py-3', isCritical && 'bg-red-500 text-white', isWarning && !isCritical && 'bg-amber-500 text-black', !isWarning && !isCritical && 'bg-primary text-black')}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">#{order.order_number}</span>
          {order.table_number && <span className="rounded bg-black/20 px-2 py-0.5 text-sm font-medium">Table {order.table_number}</span>}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 font-mono text-lg font-bold">
          <Clock className="h-5 w-5" />
          {formatTime(elapsed)}
        </div>
      </div>
      <div className="flex-1 space-y-2 p-4">
        {order.items.map((item: any, i: number) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-2">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20 font-bold text-primary">{item.quantity}</span>
            <div className="flex-1">
              <p className="font-semibold text-lg text-white">{item.name}</p>
              {item.modifiers?.length > 0 && <p className="text-sm text-zinc-400">{item.modifiers.join(', ')}</p>}
              {item.special_instructions && <p className="mt-1 text-sm text-amber-400">⚠️ {item.special_instructions}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex border-t border-zinc-700">
        <button onClick={onRecall} className="flex-1 py-4 text-center font-medium text-zinc-400 hover:bg-zinc-800">Recall</button>
        <button onClick={onBump} className="flex flex-1 items-center justify-center gap-2 bg-green-500 py-4 font-bold text-white hover:bg-green-600">
          <CheckCircle2 className="h-5 w-5" />BUMP
        </button>
      </div>
    </motion.div>
  );
}

export default function KitchenDisplayPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bumpedOrders, setBumpedOrders] = useState<string[]>([]);
  const { orders, updateOrderStatus, refetch } = useOrders({ statuses: ['confirmed', 'preparing'], autoRefresh: 5000 });
  const activeOrders = orders.filter((o) => !bumpedOrders.includes(o.id));

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <ChefHat className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
            <p className="text-sm text-zinc-400">{activeOrders.length} active</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="border-zinc-800">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} className="border-zinc-800"><RefreshCw className="h-5 w-5" /></Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {activeOrders.map((order) => (
              <KDSTicket key={order.id} order={order} onBump={() => { setBumpedOrders((p) => [...p, order.id]); updateOrderStatus({ orderId: order.id, status: 'ready' }); }} onRecall={() => setBumpedOrders((p) => p.filter((id) => id !== order.id))} />
            ))}
          </AnimatePresence>
        </div>
        {activeOrders.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500">
            <ChefHat className="mb-6 h-24 w-24 opacity-30" />
            <p className="text-2xl font-medium">All caught up!</p>
          </div>
        )}
      </main>
      <footer className="flex gap-8 justify-center border-t border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="text-center"><p className="text-3xl font-bold text-primary">{activeOrders.length}</p><p className="text-sm text-zinc-400">Active</p></div>
        <div className="text-center"><p className="text-3xl font-bold text-green-500">{bumpedOrders.length}</p><p className="text-sm text-zinc-400">Bumped</p></div>
      </footer>
    </div>
  );
}
