'use client';

import { useState } from 'react';
import { Search, Plus, Download, Upload, AlertTriangle, TrendingDown, Package } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const SAMPLE_INVENTORY = [
  { id: '1', name: 'Chicken Breast', category: 'Meat', quantity: 25, unit: 'kg', minLevel: 30, cost: 15000, supplier: 'Fresh Farms' },
  { id: '2', name: 'Tomatoes', category: 'Vegetables', quantity: 45, unit: 'kg', minLevel: 20, cost: 2000, supplier: 'Green Market' },
  { id: '3', name: 'Beer (Primus)', category: 'Beverages', quantity: 120, unit: 'bottles', minLevel: 100, cost: 1500, supplier: 'Bralirwa' },
  { id: '4', name: 'Flour', category: 'Dry Goods', quantity: 15, unit: 'kg', minLevel: 25, cost: 1200, supplier: 'Mill Co' },
  { id: '5', name: 'Olive Oil', category: 'Oils', quantity: 8, unit: 'liters', minLevel: 10, cost: 12000, supplier: 'Import Foods' },
];

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', 'Meat', 'Vegetables', 'Beverages', 'Dry Goods', 'Oils'];
  const filteredInventory = SAMPLE_INVENTORY.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const lowStockItems = SAMPLE_INVENTORY.filter(item => item.quantity < item.minLevel);
  const totalValue = SAMPLE_INVENTORY.reduce((sum, item) => sum + (item.quantity * item.cost), 0);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory</h1>
            <p className="text-sm text-zinc-400">Track stock levels and reorder</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input placeholder="Search inventory..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-zinc-900 border-zinc-800 pl-9" />
            </div>
            <Button variant="outline" className="border-zinc-800"><Download className="h-4 w-4 mr-2" />Export</Button>
            <Button variant="outline" className="border-zinc-800"><Upload className="h-4 w-4 mr-2" />Import</Button>
            <Button className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Item</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total Items</p>
                  <p className="text-2xl font-bold text-white">{SAMPLE_INVENTORY.length}</p>
                </div>
                <Package className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Low Stock</p>
                  <p className="text-2xl font-bold text-red-500">{lowStockItems.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total Value</p>
                  <p className="text-2xl font-bold text-primary">{totalValue.toLocaleString()} RWF</p>
                </div>
                <TrendingDown className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Categories</p>
                  <p className="text-2xl font-bold text-white">{categories.length - 1}</p>
                </div>
                <Package className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Categories */}
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-3 flex gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn('rounded-lg px-3 py-1.5 text-sm', categoryFilter === cat ? 'bg-primary text-black' : 'text-zinc-400 hover:bg-zinc-800')}>
            {cat}
          </button>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <table className="w-full">
            <thead className="border-b border-zinc-800">
              <tr className="text-left text-sm text-zinc-400">
                <th className="p-4">Item</th>
                <th className="p-4">Category</th>
                <th className="p-4">Quantity</th>
                <th className="p-4">Min Level</th>
                <th className="p-4">Unit Cost</th>
                <th className="p-4">Total Value</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const isLowStock = item.quantity < item.minLevel;
                return (
                  <tr key={item.id} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 font-medium text-white">{item.name}</td>
                    <td className="p-4"><Badge className="bg-zinc-800 text-zinc-300">{item.category}</Badge></td>
                    <td className="p-4">
                      <span className={cn('font-medium', isLowStock ? 'text-red-500' : 'text-white')}>
                        {item.quantity} {item.unit}
                        {isLowStock && <AlertTriangle className="inline ml-2 h-4 w-4" />}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">{item.minLevel} {item.unit}</td>
                    <td className="p-4 text-zinc-400">{item.cost.toLocaleString()} RWF</td>
                    <td className="p-4 text-white font-medium">{(item.quantity * item.cost).toLocaleString()} RWF</td>
                    <td className="p-4 text-zinc-400">{item.supplier}</td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" className="border-zinc-700">Edit</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
