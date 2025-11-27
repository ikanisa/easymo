'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VirtualizedMenuList } from './VirtualizedMenuList';
import { MenuSkeleton } from './MenuSkeleton';
import type { MenuItem } from '@/types/menu';

interface MenuContentProps {
  venueId: string;
  venueSlug: string;
  categorySlug?: string;
}

export function MenuContent({ venueId, venueSlug, categorySlug }: MenuContentProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchMenuItems = async () => {
      setLoading(true);
      
      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .eq('available', true)
        .order('sort_order');

      if (categorySlug && categorySlug !== 'all') {
        const { data: category } = await supabase
          .from('menu_categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();

        if (category) {
          query = query.eq('category_id', category.id);
        }
      }

      const { data } = await query;
      setItems(data || []);
      setLoading(false);
    };

    fetchMenuItems();
  }, [venueId, categorySlug, supabase]);

  if (loading) {
    return <MenuSkeleton />;
  }

  return <VirtualizedMenuList items={items} venueSlug={venueSlug} />;
}
