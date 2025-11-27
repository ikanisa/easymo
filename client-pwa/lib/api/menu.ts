import { createClient } from '../supabase/server';
import type { MenuItem, MenuCategory } from '@/types/menu';
import type { Venue } from '@/types/venue';

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('Error fetching venue:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    logo_url: data.logo_url,
    currency: data.currency,
    is_active: data.is_active,
    payment_methods: data.payment_methods,
  };
}

export async function getMenuCategories(venueId: string): Promise<MenuCategory[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    emoji: cat.emoji,
    display_order: cat.display_order,
  }));
}

export async function getMenuItems(venueId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_available', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching menu items:', error);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: parseFloat(item.price),
    currency: item.currency || 'RWF',
    image_url: item.image_url,
    emoji: item.emoji,
    category_id: item.category_id,
    is_available: item.is_available,
    is_popular: item.is_popular,
    is_vegetarian: item.is_vegetarian,
    prep_time_minutes: item.prep_time_minutes,
  }));
}
