'use client';

import { useState } from 'react';
import { Search, Plus, RefreshCw, Grid3X3, List, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

const SAMPLE_MENU = [
  { id: '1', name: 'Grilled Chicken', category: 'Mains', price: 15000, available: true, image: null },
  { id: '2', name: 'Caesar Salad', category: 'Starters', price: 8000, available: true, image: null },
  { id: '3', name: 'Margherita Pizza', category: 'Mains', price: 12000, available: true, image: null },
  { id: '4', name: 'Chocolate Lava Cake', category: 'Desserts', price: 6000, available: false, image: null },
  { id: '5', name: 'Craft Beer', category: 'Drinks', price: 5000, available: true, image: null },
  { id: '6', name: 'Fresh Juice', category: 'Drinks', price: 4000, available: true, image: null },
];

export default function MenuPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', 'Starters', 'Mains', 'Desserts', 'Drinks'];
  const filteredMenu = SAMPLE_MENU.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Menu</h1>
            <p className="text-sm text-zinc-400">Manage menu items and categories</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input placeholder="Search menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-zinc-900 border-zinc-800 pl-9" />
            </div>
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              <button onClick={() => setViewMode('grid')} className={cn('rounded p-2', viewMode === 'grid' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn('rounded p-2', viewMode === 'list' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Item</Button>
          </div>
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-3 flex gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn('rounded-lg px-3 py-1.5 text-sm', categoryFilter === cat ? 'bg-primary text-black' : 'text-zinc-400 hover:bg-zinc-800')}>
            {cat}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className={cn(viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2')}>
          {filteredMenu.map((item) => (
            <Card key={item.id} className="bg-zinc-900 border-zinc-800 cursor-pointer hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white">{item.name}</CardTitle>
                    <Badge className="mt-1 bg-zinc-800 text-zinc-300">{item.category}</Badge>
                  </div>
                  {!item.available && <Badge variant="destructive" className="text-xs">86'd</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-primary">{formatCurrency(item.price, 'RWF')}</span>
                  <Button size="sm" variant="outline" className="border-zinc-700">Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
