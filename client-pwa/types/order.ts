import { CartItem } from './cart';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Order {
  id: string;
  venue_id: string;
  customer_name?: string;
  customer_phone?: string;
  table_number?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  service_fee: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  estimated_ready_time?: string;
}

export interface OrderUpdate {
  order_id: string;
  status: OrderStatus;
  message?: string;
  timestamp: string;
}
