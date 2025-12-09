'use client';

import { motion } from 'framer-motion';
import { Users, Clock, MoreVertical, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  available: 'border-green-500 bg-green-500/10',
  occupied: 'border-amber-500 bg-amber-500/10',
  reserved: 'border-blue-500 bg-blue-500/10',
  dirty: 'border-red-500 bg-red-500/10',
  blocked: 'border-zinc-700 bg-zinc-800/30',
};

const STATUS_ICONS = {
  available: CheckCircle,
  occupied: Users,
  reserved: Clock,
  dirty: AlertCircle,
  blocked: Ban,
};

export function TableCard({ table, viewMode, isSelected, onSelect, onStatusChange }: any) {
  const Icon = STATUS_ICONS[table.status as keyof typeof STATUS_ICONS];

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        onClick={onSelect}
        className={cn(
          'flex items-center justify-between rounded-lg border-2 bg-zinc-900 p-4 cursor-pointer transition-all hover:shadow-lg',
          STATUS_COLORS[table.status as keyof typeof STATUS_COLORS],
          isSelected && 'ring-2 ring-primary'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', STATUS_COLORS[table.status as keyof typeof STATUS_COLORS])}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{table.table_number}</p>
            <p className="text-sm text-zinc-400">{table.capacity} seats • {table.section || 'Main'}</p>
          </div>
        </div>
        <Badge className={cn('capitalize', table.status === 'available' ? 'bg-green-500' : table.status === 'occupied' ? 'bg-amber-500' : table.status === 'reserved' ? 'bg-blue-500' : table.status === 'dirty' ? 'bg-red-500' : 'bg-zinc-500')}>
          {table.status}
        </Badge>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className={cn(
        'relative flex flex-col rounded-lg border-2 bg-zinc-900 p-4 cursor-pointer transition-all hover:shadow-lg',
        STATUS_COLORS[table.status as keyof typeof STATUS_COLORS],
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STATUS_COLORS[table.status as keyof typeof STATUS_COLORS])}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" onClick={(e) => { e.stopPropagation(); }}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-white">{table.table_number}</h3>
        <p className="text-sm text-zinc-400">{table.capacity} seats</p>
        {table.section && <p className="text-xs text-zinc-500 mt-1">{table.section}</p>}
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <Badge className={cn('w-full justify-center capitalize', table.status === 'available' ? 'bg-green-500' : table.status === 'occupied' ? 'bg-amber-500' : table.status === 'reserved' ? 'bg-blue-500' : table.status === 'dirty' ? 'bg-red-500' : 'bg-zinc-500')}>
          {table.status}
        </Badge>
      </div>
    </motion.div>
  );
}
