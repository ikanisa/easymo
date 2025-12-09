import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface DayStats {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  guests: number;
  topItems: { name: string; count: number; revenue: number }[];
}

export function useAnalytics() {
  const [todayStats, setTodayStats] = useState<DayStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchTodayStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today.toISOString());

      if (error) throw error;

      const revenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const orderCount = orders?.length || 0;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
      const guests = orders?.reduce((sum, order) => sum + (order.party_size || 1), 0) || 0;

      // Calculate top items
      const itemCounts = new Map<string, { count: number; revenue: number }>();
      orders?.forEach(order => {
        order.items?.forEach((item: any) => {
          const existing = itemCounts.get(item.name) || { count: 0, revenue: 0 };
          itemCounts.set(item.name, {
            count: existing.count + item.quantity,
            revenue: existing.revenue + (item.price * item.quantity),
          });
        });
      });

      const topItems = Array.from(itemCounts.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setTodayStats({
        revenue,
        orders: orderCount,
        avgOrderValue,
        guests,
        topItems,
      });
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTodayStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTodayStats, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchTodayStats]);

  return {
    todayStats,
    isLoading,
    refetch: fetchTodayStats,
  };
}
