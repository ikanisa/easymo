/**
 * Smart Recommendations Engine
 * AI-powered personalized menu suggestions
 */

import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface UserPreferences {
  dietaryRestrictions: string[];
  favoriteCategories: string[];
  priceRange: { min: number; max: number };
  spiceLevel: 'mild' | 'medium' | 'hot' | 'any';
  previousOrders: string[];
}

interface RecommendationContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  weather?: 'hot' | 'cold' | 'rainy';
  specialOccasion?: string;
  partySize?: number;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  dietary_tags?: string[];
  tags?: string[];
  is_popular?: boolean;
  is_featured?: boolean;
  [key: string]: any;
}

export class RecommendationEngine {
  private supabase = createClient();
  private userPreferences: UserPreferences | null = null;
  private context: RecommendationContext;

  constructor() {
    this.context = this.getContext();
  }

  private getContext(): RecommendationContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: RecommendationContext['timeOfDay'];
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return {
      timeOfDay,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  }

  async loadUserPreferences(userId: string): Promise<void> {
    const { data: profile } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: orders } = await this.supabase
      .from('orders')
      .select('items')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const previousItems = orders?.flatMap(o => 
      (o.items as any[])?.map(i => i.menu_item_id) || []
    ) || [];

    this.userPreferences = {
      dietaryRestrictions: profile?.dietary_restrictions || [],
      favoriteCategories: profile?.favorite_categories || [],
      priceRange: profile?.price_preference || { min: 0, max: 50000 },
      spiceLevel: 'any',
      previousOrders: previousItems,
    };
  }

  async getPersonalizedRecommendations(
    venueId: string,
    limit: number = 6
  ): Promise<MenuItem[]> {
    const { data: allItems } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('available', true);

    if (!allItems) return [];

    const scoredItems = allItems.map(item => ({
      item,
      score: this.calculateItemScore(item),
    }));

    scoredItems.sort((a, b) => b.score - a.score);
    
    return scoredItems.slice(0, limit).map(s => s.item);
  }

  private calculateItemScore(item: MenuItem): number {
    let score = 0;

    if (item.is_popular) score += 30;
    if (item.is_featured) score += 20;

    if (this.context.timeOfDay === 'morning' && item.category === 'breakfast') score += 40;
    if (this.context.timeOfDay === 'afternoon' && item.category === 'lunch') score += 30;
    if (this.context.timeOfDay === 'evening' && item.category === 'dinner') score += 35;
    if (this.context.timeOfDay === 'night' && item.category === 'drinks') score += 40;

    if (['Saturday', 'Sunday'].includes(this.context.dayOfWeek)) {
      if (item.category === 'brunch') score += 30;
      if (item.category === 'cocktails') score += 25;
    }

    if (this.userPreferences) {
      if (this.userPreferences.favoriteCategories.includes(item.category)) {
        score += 25;
      }

      if (this.userPreferences.dietaryRestrictions.length > 0) {
        const itemTags = item.dietary_tags || [];
        const matches = this.userPreferences.dietaryRestrictions.filter(
          r => itemTags.includes(r)
        );
        score += matches.length * 15;
      }

      if (item.price >= this.userPreferences.priceRange.min &&
          item.price <= this.userPreferences.priceRange.max) {
        score += 10;
      }

      if (this.userPreferences.previousOrders.includes(item.id)) {
        score += 15;
      }
    }

    score += Math.random() * 10;

    return score;
  }

  async getPairingRecommendations(
    itemId: string,
    venueId: string
  ): Promise<MenuItem[]> {
    const { data: item } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!item) return [];

    const pairingRules: Record<string, string[]> = {
      'steak': ['red_wine', 'beer', 'whiskey'],
      'seafood': ['white_wine', 'champagne'],
      'pizza': ['beer', 'soda', 'red_wine'],
      'burger': ['beer', 'soda', 'milkshake'],
      'dessert': ['coffee', 'digestif', 'sweet_wine'],
      'spicy': ['beer', 'lassi', 'milk'],
    };

    const itemTags = item.tags || [];
    let targetCategories: string[] = [];
    
    for (const [tag, pairings] of Object.entries(pairingRules)) {
      if (itemTags.includes(tag) || item.name.toLowerCase().includes(tag)) {
        targetCategories.push(...pairings);
      }
    }

    if (targetCategories.length === 0) {
      targetCategories = ['drinks', 'beverages'];
    }

    const { data: pairings } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .eq('available', true)
      .in('category', targetCategories)
      .limit(4);

    return pairings || [];
  }
}

export function useRecommendations(venueId: string, userId?: string) {
  const [recommendations, setRecommendations] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const engineRef = useRef<RecommendationEngine | null>(null);

  useEffect(() => {
    const loadRecommendations = async () => {
      setLoading(true);
      
      const engine = new RecommendationEngine();
      engineRef.current = engine;
      
      if (userId) {
        await engine.loadUserPreferences(userId);
      }
      
      const items = await engine.getPersonalizedRecommendations(venueId);
      setRecommendations(items);
      setLoading(false);
    };

    loadRecommendations();
  }, [venueId, userId]);

  const getPairings = useCallback(async (itemId: string) => {
    if (!engineRef.current) return [];
    return engineRef.current.getPairingRecommendations(itemId, venueId);
  }, [venueId]);

  return { recommendations, loading, getPairings };
}
