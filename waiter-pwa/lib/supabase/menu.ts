import { createClient } from '@/lib/supabase/client'
import type { MenuCategory, MenuItem } from '@/types/menu'

export async function getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function getMenuItems(restaurantId: string, categoryId?: string): Promise<MenuItem[]> {
  const supabase = createClient()
  
  let query = supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('available', true)
  
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }
  
  const { data, error } = await query.order('name', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function searchMenuItems(restaurantId: string, query: string): Promise<MenuItem[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('available', true)
    .textSearch('name', query, {
      type: 'websearch',
      config: 'english'
    })
    .limit(20)
  
  if (error) throw error
  return data || []
}
