import { MenuItem } from './menu';

export interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
  customizations?: Record<string, any>;
}

export interface Cart {
  items: CartItem[];
  venue_id: string;
  table_number?: string;
  subtotal: number;
  tax: number;
  service_fee: number;
  total: number;
}
