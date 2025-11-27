import { supabase } from '../supabase/client';

interface CreateOrderData {
  venueId: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  total: number;
  currency: string;
  notes?: string;
}

export async function createOrder(data: CreateOrderData) {
  try {
    const { data: order, error } = await supabase
      .from('client_orders')
      .insert({
        venue_id: data.venueId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        table_number: data.tableNumber,
        items: data.items,
        subtotal: data.subtotal,
        total: data.total,
        currency: data.currency,
        notes: data.notes,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      return null;
    }

    return {
      id: order.id,
      status: order.status,
      total: order.total,
      currency: order.currency,
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function getOrder(orderId: string) {
  try {
    const { data: order, error } = await supabase
      .from('client_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('Error fetching order:', error);
      return null;
    }

    return {
      id: order.id,
      venueId: order.venue_id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      tableNumber: order.table_number,
      items: order.items,
      subtotal: parseFloat(order.subtotal),
      total: parseFloat(order.total),
      currency: order.currency,
      status: order.status,
      paymentStatus: order.payment_status,
      notes: order.notes,
      createdAt: order.created_at,
      estimatedReadyTime: order.estimated_ready_time,
    };
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}

export async function updatePaymentStatus(
  orderId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  method: 'momo' | 'revolut' | 'cash' | 'card'
) {
  try {
    const { error } = await supabase
      .from('client_orders')
      .update({
        payment_status: status,
        payment_method: method,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating payment status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}
