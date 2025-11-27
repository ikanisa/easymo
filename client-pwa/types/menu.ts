export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image_url?: string;
  category_id: string;
  is_available: boolean;
  is_popular?: boolean;
  prep_time_minutes?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji?: string;
  display_order: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
}
