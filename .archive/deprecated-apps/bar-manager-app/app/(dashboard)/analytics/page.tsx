'use client';

import { useState } from 'react';
import { TrendingUp, Download, Calendar, DollarSign, ShoppingBag, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const SAMPLE_SALES_DATA = [
  { date: 'Mon', revenue: 850000, orders: 45 },
  { date: 'Tue', revenue: 920000, orders: 52 },
  { date: 'Wed', revenue: 780000, orders: 38 },
  { date: 'Thu', revenue: 1100000, orders: 61 },
  { date: 'Fri', revenue: 1450000, orders: 78 },
  { date: 'Sat', revenue: 1680000, orders: 89 },
  { date: 'Sun', revenue: 1320000, orders: 72 },
];

const TOP_ITEMS = [
  { name: 'Grilled Chicken', sold: 145, revenue: 2175000 },
  { name: 'Caesar Salad', sold: 98, revenue: 784000 },
  { name: 'Margherita Pizza', sold: 87, revenue: 1044000 },
  { name: 'Craft Beer', sold: 234, revenue: 1170000 },
  { name: 'Fresh Juice', sold: 156, revenue: 624000 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week');

  const totalRevenue = SAMPLE_SALES_DATA.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = SAMPLE_SALES_DATA.reduce((sum, d) => sum + d.orders, 0);
  const avgOrderValue = Math.round(totalRevenue / totalOrders);
  const maxRevenue = Math.max(...SAMPLE_SALES_DATA.map(d => d.revenue));

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-zinc-400">Sales insights and trends</p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              {['day', 'week', 'month', 'year'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded px-3 py-1.5 text-sm capitalize ${period === p ? 'bg-primary text-black' : 'text-zinc-400'}`}>
                  {p}
                </button>
              ))}
            </div>
            <Button variant="outline" className="border-zinc-800">
              <Download className="h-4 w-4 mr-2" />Export PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalRevenue.toLocaleString()} RWF</div>
              <p className="text-xs text-green-500 flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12.5% from last {period}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalOrders}</div>
              <p className="text-xs text-green-500 flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8.2% from last {period}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Avg Order Value</CardTitle>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{avgOrderValue.toLocaleString()} RWF</div>
              <p className="text-xs text-zinc-400 mt-1">Per transaction</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Peak Day</CardTitle>
              <Calendar className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Saturday</div>
              <p className="text-xs text-zinc-400 mt-1">{maxRevenue.toLocaleString()} RWF</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="col-span-2 bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {SAMPLE_SALES_DATA.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-zinc-400">{(day.revenue / 1000).toFixed(0)}k</div>
                    <div className="w-full bg-primary/20 rounded-t flex items-end" style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}>
                      <div className="w-full bg-primary rounded-t" style={{ height: '100%' }} />
                    </div>
                    <div className="text-xs font-medium text-zinc-300">{day.date}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Items */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Top Selling Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {TOP_ITEMS.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="text-xs text-zinc-500">{item.sold} sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary">{(item.revenue / 1000).toFixed(0)}k</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders by Hour */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Orders by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-1">
              {Array.from({ length: 24 }, (_, i) => {
                const orders = Math.floor(Math.random() * 15) + 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500/20 rounded-t flex items-end" style={{ height: `${(orders / 15) * 100}%` }}>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: '100%' }} />
                    </div>
                    {i % 3 === 0 && <div className="text-xs text-zinc-500">{i}h</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
