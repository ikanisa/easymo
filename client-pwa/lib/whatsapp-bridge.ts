/**
 * Bridge between PWA and WhatsApp AI Agent
 * Allows users to switch channels seamlessly
 */

import { createClient } from '@/lib/supabase/client';

export interface WhatsAppSession {
  sessionId: string;
  phone: string;
  lastInteraction: string;
  cart?: any[];
  context?: Record<string, any>;
}

export class WhatsAppBridge {
  private supabase = createClient();

  async linkSession(pwaSessionId: string, whatsappPhone: string): Promise<void> {
    await this.supabase.from('session_links').upsert({
      pwa_session_id: pwaSessionId,
      whatsapp_phone: whatsappPhone,
      linked_at: new Date().toISOString(),
    });
  }

  async getWhatsAppSession(phone: string): Promise<WhatsAppSession | null> {
    const { data } = await this.supabase
      .from('ai_agent_sessions')
      .select('*')
      .eq('phone', phone)
      .eq('agent_type', 'waiter')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      sessionId: data.id,
      phone: data.phone,
      lastInteraction: data.updated_at,
      cart: data.context?.cart,
      context: data.context,
    };
  }

  async syncCartFromWhatsApp(phone: string): Promise<any[]> {
    const session = await this.getWhatsAppSession(phone);
    return session?.cart || [];
  }

  generateWhatsAppLink(venuePhone: string, orderId: string): string {
    const message = encodeURIComponent(
      `Hi! I need help with my order #${orderId.slice(-8).toUpperCase()}`
    );
    return `https://wa.me/${venuePhone.replace(/[^0-9]/g, '')}?text=${message}`;
  }

  async sendOrderToWhatsApp(
    phone: string,
    orderId: string,
    items: any[],
    total: number
  ): Promise<void> {
    await this.supabase.functions.invoke('send-whatsapp', {
      body: {
        to: phone,
        template: 'order_confirmation',
        params: {
          order_id: orderId.slice(-8).toUpperCase(),
          items_count: items.length,
          total: total.toLocaleString(),
        },
      },
    });
  }
}

export const whatsappBridge = new WhatsAppBridge();
