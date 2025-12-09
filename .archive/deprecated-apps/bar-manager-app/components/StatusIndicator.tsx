/**
 * Real-time Connection Status Indicator
 * Shows live connection status and latency
 */

'use client';

import { useRealtimeStatus } from '@/lib/supabase/realtime';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RealtimeStatusIndicator() {
  const { status, latency } = useRealtimeStatus();

  const statusConfig = {
    connected: {
      icon: Wifi,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      label: 'Live',
      pulse: true,
    },
    connecting: {
      icon: Activity,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: 'Connecting...',
      pulse: false,
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      label: 'Offline',
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border',
        config.bg,
        config.border
      )}
      title={`Latency: ${latency}ms`}
    >
      {config.pulse && (
        <span className={cn('w-2 h-2 rounded-full animate-pulse', config.color.replace('text-', 'bg-'))} />
      )}
      <Icon className={cn('w-4 h-4', config.color)} />
      <span className={cn('text-sm font-medium', config.color)}>
        {config.label}
      </span>
      {status === 'connected' && latency > 0 && (
        <span className="text-xs text-muted-foreground">
          ({latency}ms)
        </span>
      )}
    </div>
  );
}
