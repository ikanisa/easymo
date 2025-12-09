export interface Order {
  id: string
  order_code: string
  status: 'pending' | 'preparing' | 'confirmed' | 'served' | 'cancelled'
  table_label: string
  total_minor: number
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export interface OrderItem {
  id: string
  item_name: string
  qty: number
  price_minor: number
  status: string
}

export interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  is_available: boolean
  image_url: string | null
  display_order: number
}

export interface Promo {
  id: string
  bar_id: string
  name: string
  description: string | null
  promo_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'happy_hour'
  discount_value: number | null
  buy_quantity: number | null
  get_quantity: number | null
  applies_to: 'all' | 'category' | 'items'
  category: string | null
  start_time: string | null
  end_time: string | null
  days_of_week: number[]
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
