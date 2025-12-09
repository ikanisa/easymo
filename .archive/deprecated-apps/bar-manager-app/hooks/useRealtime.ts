import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function useRealtime<T = any>(
  table: string,
  callback: (payload: any) => void,
  filter?: string
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, callback]);

  return { isConnected };
}
