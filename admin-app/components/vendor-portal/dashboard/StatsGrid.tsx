'use client';

/**
 * StatsGrid - Dashboard 2x2 metrics cards
 * Displays Today, This Week, Payers, and This Month stats
 */

import { TrendingDown, TrendingUp } from 'lucide-react';

import { MoneyDisplay } from '@/components/vendor-portal/ui';
import type { DashboardStats } from '@/lib/vendor-portal/types';

interface StatsGridProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export function StatsGrid({ stats, isLoading = false }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="vp-stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="vp-card vp-stat-card">
            <div className="vp-skeleton h-4 w-16 mb-2" />
            <div className="vp-skeleton h-6 w-24 mb-1" />
            <div className="vp-skeleton h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="vp-stats-grid">
      {/* Today */}
      <div className="vp-card vp-stat-card">
        <p className="vp-stat-card__label">Today</p>
        <p className="vp-stat-card__value">
          <MoneyDisplay 
            amount={stats.today.amount} 
            currency={stats.today.currency} 
          />
        </p>
        <span className={`vp-stat-card__change vp-stat-card__change--${stats.today.changeType}`}>
          {stats.today.changeType === 'positive' ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          {stats.today.change}%
        </span>
      </div>

      {/* This Week */}
      <div className="vp-card vp-stat-card">
        <p className="vp-stat-card__label">This Week</p>
        <p className="vp-stat-card__value">
          <MoneyDisplay 
            amount={stats.thisWeek.amount} 
            currency={stats.thisWeek.currency} 
          />
        </p>
        <span className="text-sm text-gray-500">
          {stats.thisWeek.transactionCount} txns
        </span>
      </div>

      {/* Unique Payers */}
      <div className="vp-card vp-stat-card">
        <p className="vp-stat-card__label">Payers</p>
        <p className="vp-stat-card__value">{stats.uniquePayers.count}</p>
        <span className="vp-stat-card__change vp-stat-card__change--positive">
          +{stats.uniquePayers.newThisWeek} new
        </span>
      </div>

      {/* This Month */}
      <div className="vp-card vp-stat-card">
        <p className="vp-stat-card__label">This Month</p>
        <p className="vp-stat-card__value">
          <MoneyDisplay 
            amount={stats.thisMonth.amount} 
            currency={stats.thisMonth.currency} 
          />
        </p>
        <span className="text-sm text-gray-500">
          {stats.thisMonth.transactionCount} txns
        </span>
      </div>
    </div>
  );
}
