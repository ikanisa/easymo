/**
 * Product Search Tools
 * 
 * Tools for searching and checking inventory of marketplace products.
 */

import { childLogger } from '@easymo/commons';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Tool } from '../../../../types/agent.types';

const log = childLogger({ service: 'agents', tool: 'search-products' });

/**
 * Search for products across all categories
 */
export function searchProducts(supabase: SupabaseClient): Tool {
  return {
    name: 'search_products',
    description: 'Search for products in the marketplace across all categories.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for products' },
        category: { 
          type: 'string', 
          description: 'Product category filter (pharmacy, hardware, grocery)' 
        },
        price_max: { type: 'number', description: 'Maximum price filter' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['query']
    },
    execute: async (params, context) => {
      const { query, category, price_max, limit = 10 } = params;
      
      log.info({ query, category, price_max }, 'Searching products');
      
      let queryBuilder = supabase
        .from('products')
        .select('*')
        .ilike('name', `%${query}%`)
        .eq('is_active', true);
      
      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }
      
      if (price_max) {
        queryBuilder = queryBuilder.lte('price', price_max);
      }
      
      const { data, error } = await queryBuilder.limit(limit);
      
      if (error) {
        log.error({ error, query }, 'Product search failed');
        throw new Error(`Product search failed: ${error.message}`);
      }
      
      return { products: data };
    }
  };
}

/**
 * Check inventory/stock for a specific product
 */
export function inventoryCheck(supabase: SupabaseClient): Tool {
  return {
    name: 'inventory_check',
    description: 'Check stock availability for a specific product.',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID to check' },
        location_id: { 
          type: 'string', 
          description: 'Optional location/store ID to check specific inventory' 
        }
      },
      required: ['product_id']
    },
    execute: async (params, context) => {
      const { product_id, location_id } = params;
      
      log.info({ product_id, location_id }, 'Checking inventory');
      
      let queryBuilder = supabase
        .from('inventory')
        .select('*, product:products(*), location:locations(*)')
        .eq('product_id', product_id)
        .gt('quantity', 0);
      
      if (location_id) {
        queryBuilder = queryBuilder.eq('location_id', location_id);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        log.error({ error, product_id }, 'Inventory check failed');
        throw new Error(`Inventory check failed: ${error.message}`);
      }
      
      return { inventory: data };
    }
  };
}

/**
 * Get all product-related tools
 */
export function getProductTools(supabase: SupabaseClient): Tool[] {
  return [
    searchProducts(supabase),
    inventoryCheck(supabase)
  ];
}
