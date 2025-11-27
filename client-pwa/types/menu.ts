export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image_url?: string;
  emoji?: string;
  category_id: string;
  is_available: boolean;
  is_popular?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  prep_time_minutes?: number;
  allergens?: string[];
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  display_order: number;
  item_count?: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  address?: string;
  phone?: string;
  currency: string;
  is_active: boolean;
}
