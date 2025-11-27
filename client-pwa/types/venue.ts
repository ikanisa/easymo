export interface Venue {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  city?: string;
  country: string;
  phone?: string;
  email?: string;
  opening_hours?: Record<string, { open: string; close: string }>;
  accepts_momo: boolean;
  accepts_revolut: boolean;
  momo_bar_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  slug: string;
  description?: string;
  emoji?: string;
  display_order: number;
  is_active: boolean;
  item_count?: number;
}

export interface MenuItem {
  id: string;
  venue_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  emoji?: string;
  is_available: boolean;
  is_popular: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  allergens?: string[];
  prep_time_minutes?: number;
  calories?: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface VenueWithMenu {
  venue: Venue;
  categories: MenuCategory[];
  items: MenuItem[];
}
