/**
 * Marketplace API - Works with existing Supabase tables
 */

import { supabase } from "@/integrations/supabase/client";

export const MarketplaceApi = {
  // Categories management
  categories: {
    list: async () => {
      const { data, error } = await (supabase as any)
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    create: async (categoryData: {
      name: string;
      is_active?: boolean;
      sort_order?: number;
    }) => {
      const { data, error } = await (supabase as any)
        .from('marketplace_categories')
        .insert([{
          name: categoryData.name,
          is_active: categoryData.is_active ?? true,
          sort_order: categoryData.sort_order || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (id: number, updates: Partial<{
      name: string;
      is_active: boolean;
      sort_order: number;
    }>) => {
      const { data, error } = await (supabase as any)
        .from('marketplace_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: number) => {
      const { error } = await (supabase as any)
        .from('marketplace_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  },

  // Businesses management
  businesses: {
    list: async (filters?: {
      category_id?: number;
      is_active?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      let query = (supabase as any)
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 20)) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    get: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },

    create: async (businessData: {
      name: string;
      description?: string;
      owner_whatsapp: string;
      catalog_url?: string;
      category_id?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await (supabase as any)
        .from('businesses')
        .insert([{
          ...businessData,
          is_active: businessData.is_active ?? true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Partial<{
      name: string;
      description: string;
      owner_whatsapp: string;
      catalog_url: string;
      category_id: number;
      is_active: boolean;
    }>) => {
      const { data, error } = await (supabase as any)
        .from('businesses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await (supabase as any)
        .from('businesses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  },
};