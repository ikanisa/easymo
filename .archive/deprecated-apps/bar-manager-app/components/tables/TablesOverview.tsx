'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Plus, Grid3X3, List, RefreshCw, Clock, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import { useTables } from '@/hooks/useOrders';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TableCard } from './TableCard';
import { cn } from '@/lib/utils';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty' | 'blocked';

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; icon: any }> = {
  available: { label: 'Available', color: 'bg-green-500', icon: CheckCircle },
  occupied: { label: 'Occupied', color: 'bg-amber-500', icon: Users },
  reserved: { label: 'Reserved', color: 'bg-blue-500', icon: Clock },
  dirty: { label: 'Dirty', color: 'bg-red-500', icon: AlertCircle },
  blocked: { label: 'Blocked', color: 'bg-zinc-500', icon: Ban },
};

export function TablesOverview() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { tables, isLoading, refetch, updateTable } = useTables();

  const filteredTables = useMemo(() => {
    let filtered = tables || [];
    if (statusFilter !== 'all') filtered = filtered.filter((t) => t.status === statusFilter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.table_number.toLowerCase().includes(query) || t.section?.toLowerCase().includes(query));
    }
    return filtered;
  }, [tables, statusFilter, searchQuery]);

  const sections = useMemo(() => {
    const map = new Map();
    filteredTables.forEach((t) => {
      const sec = t.section || 'Main';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec).push(t);
    });
    return Array.from(map.entries());
  }, [filteredTables]);

  const stats = useMemo(() => {
    const all = tables || [];
    return {
      total: all.length,
      available: all.filter((t) => t.status === 'available').length,
      occupied: all.filter((t) => t.status === 'occupied').length,
      reserved: all.filter((t) => t.status === 'reserved').length,
      dirty: all.filter((t) => t.status === 'dirty').length,
    };
  }, [tables]);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tables</h1>
            <p className="text-sm text-zinc-400">Manage table status</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-zinc-900 border-zinc-800 pl-9" />
            </div>
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              <button onClick={() => setViewMode('grid')} className={cn('rounded p-2', viewMode === 'grid' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn('rounded p-2', viewMode === 'list' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} className="border-zinc-800 bg-zinc-900">
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            <Button className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Table</Button>
          </div>
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-3 flex gap-2">
        <button onClick={() => setStatusFilter('all')} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm', statusFilter === 'all' ? 'bg-primary text-black' : 'text-zinc-400 hover:bg-zinc-800')}>
          All<Badge variant="secondary" className="bg-zinc-800">{stats.total}</Badge>
        </button>
        {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm', statusFilter === s ? 'bg-primary text-black' : 'text-zinc-400 hover:bg-zinc-800')}>
              <Icon className="h-4 w-4" />{cfg.label}<Badge variant="secondary" className="bg-zinc-800">{stats[s as keyof typeof stats] || 0}</Badge>
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {sections.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-zinc-500">
            <Users className="mb-4 h-12 w-12 opacity-50" />
            <p>No tables found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map(([section, tables]) => (
              <div key={section}>
                <h2 className="mb-4 text-lg font-semibold text-white">{section}</h2>
                <div className={cn(viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2')}>
                  <AnimatePresence>{tables.map((t: any) => <TableCard key={t.id} table={t} viewMode={viewMode} isSelected={selectedTableId === t.id} onSelect={() => setSelectedTableId(t.id)} onStatusChange={(status) => updateTable({ id: t.id, status })} />)}</AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
