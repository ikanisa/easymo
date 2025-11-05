/**
 * Baskets API - Works with existing Supabase tables
 */

import { supabase } from "@/integrations/supabase/client";

export const BasketApi = {
  // Create a new basket
  create: async (basketData: {
    name: string;
    description?: string;
    type: 'public' | 'private';
    momo_payee_number?: string;
    momo_ussd_code?: string;
    momo_target?: string;
    momo_is_code?: boolean;
  }) => {
    const { data, error } = await (supabase as any)
      .from('baskets')
      .insert([{
        ...basketData,
        status: 'draft',
        public_slug: basketData.type === 'public' ? `basket-${Date.now()}` : null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // List all baskets
  list: async (filters?: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) => {
    let query = (supabase as any)
      .from('baskets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
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

  // Get basket by ID
  get: async (id: string) => {
    const { data, error } = await (supabase as any)
      .from('baskets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update basket
  update: async (id: string, updates: Partial<{
    name: string;
    description: string;
    status: string;
    momo_payee_number: string;
    momo_ussd_code: string;
    momo_target: string;
    momo_is_code: boolean;
  }>) => {
    const { data, error } = await (supabase as any)
      .from('baskets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete basket
  delete: async (id: string) => {
    const { error } = await (supabase as any)
      .from('baskets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get basket members
  getMembers: async (basketId: string) => {
    const { data, error } = await (supabase as any)
      .from('basket_members')
      .select('*')
      .eq('basket_id', basketId)
      .order('total_contributed', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Add member to basket
  addMember: async (basketId: string, memberData: {
    user_id: string;
    member_code?: string;
    role?: string;
  }) => {
    const { data, error } = await (supabase as any)
      .from('basket_members')
      .insert([{
        basket_id: basketId,
        user_id: memberData.user_id,
        member_code: memberData.member_code,
        role: memberData.role || 'member',
        total_contributed: 0,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update member contribution
  updateContribution: async (basketId: string, userId: string, amount: number) => {
    const { data, error } = await (supabase as any)
      .from('basket_members')
      .update({ 
        total_contributed: amount 
      })
      .eq('basket_id', basketId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Remove member from basket
  removeMember: async (basketId: string, userId: string) => {
    const { error } = await (supabase as any)
      .from('basket_members')
      .delete()
      .eq('basket_id', basketId)
      .eq('user_id', userId);

    if (error) throw error;
  },
};