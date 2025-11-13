export interface MenuCategory {
  id: string
  name: string
  description: string | null
  icon_emoji: string | null
  sort_order: number
  created_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  available: boolean
  allergens: string[] | null
  dietary_tags: string[] | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  menu_item: MenuItem
  quantity: number
  subtotal: number
}
