/**
 * Integration with Bar Manager Desktop App
 * Real-time order synchronization
 */

import { createClient } from '@/lib/supabase/client';

export interface OrderSyncPayload {
  orderId: string;
  venueId: string;
  tableNumber?: string;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  total: number;
  customerPhone?: string;
  source: 'pwa' | 'whatsapp';
}

export class ManagerSync {
  private supabase = createClient();

  async syncOrder(payload: OrderSyncPayload): Promise<void> {
    const { error } = await this.supabase.from('orders').insert({
      id: payload.orderId,
      venue_id: payload.venueId,
      table_id: payload.tableNumber,
      items: payload.items,
      total: payload.total,
      customer_phone: payload.customerPhone,
      source: payload.source,
      status: 'pending',
    });

    if (error) throw error;

    await this.notifyManager(payload);
  }

  private async notifyManager(payload: OrderSyncPayload): Promise<void> {
    try {
      await this.supabase.functions.invoke('notify-manager', {
        body: {
          type: 'new_order',
          orderId: payload.orderId,
          venueId: payload.venueId,
          tableNumber: payload.tableNumber,
          itemCount: payload.items.length,
          total: payload.total,
        },
      });
    } catch (error) {
      console.warn('Failed to notify manager:', error);
    }
  }

  subscribeToOrderUpdates(
    orderId: string,
    onUpdate: (status: string, message?: string) => void
  ): () => void {
    const channel = this.supabase
      .channel(`order-updates-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          onUpdate(payload.new.status, payload.new.status_message);
        }
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}

export const managerSync = new ManagerSync();
