'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAnalytics, useOrders } from '@/hooks/useOrders';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { todayStats, isLoading: statsLoading } = useAnalytics();
  const { orders, activeOrders, newOrderCount, isLoading: ordersLoading } = useOrders();

  const stats = [
    {
      title: 'Revenue Today',
      value: todayStats ? formatCurrency(todayStats.totalRevenue, 'RWF') : '...',
      icon: DollarSign,
      change: '+12.5%',
      changeType: 'positive' as const,
      loading: statsLoading,
    },
    {
      title: 'Total Orders',
      value: todayStats ? formatNumber(todayStats.totalOrders) : '...',
      icon: ShoppingBag,
      change: '+8.2%',
      changeType: 'positive' as const,
      loading: statsLoading,
    },
    {
      title: 'Active Orders',
      value: formatNumber(activeOrders.length),
      icon: Clock,
      change: newOrderCount > 0 ? `+${newOrderCount} new` : 'No new',
      changeType: newOrderCount > 0 ? 'positive' : 'neutral' as const,
      loading: ordersLoading,
    },
    {
      title: 'Completed',
      value: todayStats ? formatNumber(todayStats.completedOrders) : '...',
      icon: CheckCircle,
      change: todayStats ? `${Math.round((todayStats.completedOrders / todayStats.totalOrders) * 100)}% rate` : '...',
      changeType: 'neutral' as const,
      loading: statsLoading,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Command Center</h1>
            <p className="text-sm text-zinc-400">Real-time overview of your venue</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-500">Live</span>
            </div>
            <span className="text-sm text-zinc-500">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="flex-1 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-zinc-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {stat.loading ? (
                      <div className="h-8 w-24 animate-pulse rounded bg-zinc-800" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  {!stat.loading && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                      {stat.changeType === 'positive' && <TrendingUp className="h-3 w-3 text-green-500" />}
                      {stat.changeType === 'negative' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      <span className={
                        stat.changeType === 'positive' ? 'text-green-500' :
                        stat.changeType === 'negative' ? 'text-red-500' :
                        'text-zinc-500'
                      }>
                        {stat.change}
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Orders */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Recent Orders</CardTitle>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                {activeOrders.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-800" />
                ))}
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="h-12 w-12 text-zinc-700 mb-3" />
                <p className="text-zinc-500">No active orders</p>
                <p className="text-sm text-zinc-600">Orders will appear here when customers place them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${
                        order.status === 'pending' ? 'bg-blue-500/10 text-blue-500' :
                        order.status === 'preparing' ? 'bg-amber-500/10 text-amber-500' :
                        order.status === 'ready' ? 'bg-green-500/10 text-green-500' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Order #{order.order_number}</p>
                        <p className="text-sm text-zinc-500">
                          {order.table_number ? `Table ${order.table_number}` : 'Takeaway'} • {order.items.length} items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">{formatCurrency(order.total, order.currency)}</p>
                      <Badge variant={
                        order.status === 'pending' ? 'default' :
                        order.status === 'preparing' ? 'warning' :
                        order.status === 'ready' ? 'success' :
                        'secondary'
                      } className="mt-1">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
