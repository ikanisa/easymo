export type OrderStatus = 
  | 'pending'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export type PaymentMethod = 'momo' | 'revolut' | 'cash';

export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  modifiers?: Array<{
    name: string;
    price: number;
  }>;
}

export interface Order {
  id: string;
  venue_id: string;
  table_number: string;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  special_instructions?: string;
  estimated_ready_at?: string;
  ready_at?: string;
  served_at?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface CreateOrderRequest {
  venue_id: string;
  table_number: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method: PaymentMethod;
  special_instructions?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    unit_price: number;
    notes?: string;
  }>;
}

export interface CreateOrderResponse {
  order_id: string;
  status: OrderStatus;
  payment_instructions?: {
    ussd_code?: string;
    bar_code?: string;
    payment_link?: string;
    instructions: string;
  };
}
