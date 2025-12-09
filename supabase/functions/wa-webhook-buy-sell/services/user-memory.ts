/**
 * User Memory Service
 * 
 * Manages user preferences, past orders, and learned behaviors
 * to provide personalized service across sessions.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";

// =====================================================
// TYPES
// =====================================================

export type MemoryType = 
  | "preference" 
  | "past_order" 
  | "favorite_vendor" 
  | "location" 
  | "medical_info" 
  | "feedback";

export interface UserMemory {
  id: string;
  user_phone: string;
  memory_type: MemoryType;
  memory_key: string;
  memory_value: Record<string, unknown>;
  confidence: number;
  source: string;
  last_used_at: string;
  use_count: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface MemoryEntry {
  memory_type: MemoryType;
  memory_key: string;
  memory_value: Record<string, unknown>;
  confidence?: number;
  source?: string;
  expires_at?: string;
}

// =====================================================
// USER MEMORY SERVICE
// =====================================================

export class UserMemoryService {
  private supabase: SupabaseClient;
  private correlationId?: string;

  constructor(supabase: SupabaseClient, correlationId?: string) {
    this.supabase = supabase;
    this.correlationId = correlationId;
  }

  /**
   * Store or update a memory for a user
   */
  async storeMemory(
    userPhone: string,
    entry: MemoryEntry
  ): Promise<{ success: boolean; memoryId?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc("upsert_agent_user_memory", {
        p_user_phone: userPhone,
        p_memory_type: entry.memory_type,
        p_memory_key: entry.memory_key,
        p_memory_value: entry.memory_value,
        p_confidence: entry.confidence || 1.0,
        p_source: entry.source || "inferred",
        p_expires_at: entry.expires_at || null,
      });

      if (error) {
        logStructuredEvent(
          "USER_MEMORY_STORE_ERROR",
          {
            error: error.message,
            userPhone: userPhone.slice(-4),
            memoryType: entry.memory_type,
            correlationId: this.correlationId,
          },
          "error"
        );
        return { success: false, error: error.message };
      }

      logStructuredEvent("USER_MEMORY_STORED", {
        memoryId: data,
        userPhone: userPhone.slice(-4),
        memoryType: entry.memory_type,
        memoryKey: entry.memory_key,
        correlationId: this.correlationId,
      });

      recordMetric("user.memory.stored", 1, {
        memory_type: entry.memory_type,
      });

      return { success: true, memoryId: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Recall memories for a user
   */
  async recallMemories(
    userPhone: string,
    memoryTypes?: MemoryType[]
  ): Promise<UserMemory[]> {
    try {
      const { data, error } = await this.supabase.rpc("get_user_memories", {
        p_user_phone: userPhone,
        p_memory_types: memoryTypes || null,
      });

      if (error) {
        logStructuredEvent(
          "USER_MEMORY_RECALL_ERROR",
          {
            error: error.message,
            userPhone: userPhone.slice(-4),
            correlationId: this.correlationId,
          },
          "error"
        );
        return [];
      }

      if (data && data.length > 0) {
        logStructuredEvent("USER_MEMORY_RECALLED", {
          userPhone: userPhone.slice(-4),
          memoryCount: data.length,
          correlationId: this.correlationId,
        });

        recordMetric("user.memory.recalled", data.length);
      }

      return data || [];
    } catch (error) {
      logStructuredEvent(
        "USER_MEMORY_RECALL_EXCEPTION",
        {
          error: error instanceof Error ? error.message : String(error),
          userPhone: userPhone.slice(-4),
          correlationId: this.correlationId,
        },
        "error"
      );
      return [];
    }
  }

  /**
   * Get specific memory by key
   */
  async getMemory(
    userPhone: string,
    memoryType: MemoryType,
    memoryKey: string
  ): Promise<UserMemory | null> {
    try {
      const { data, error } = await this.supabase
        .from("agent_user_memory")
        .select("*")
        .eq("user_phone", userPhone)
        .eq("memory_type", memoryType)
        .eq("memory_key", memoryKey)
        .single();

      if (error || !data) {
        return null;
      }

      // Update last_used_at
      await this.supabase
        .from("agent_user_memory")
        .update({
          last_used_at: new Date().toISOString(),
          use_count: data.use_count + 1,
        })
        .eq("id", data.id);

      return data as UserMemory;
    } catch {
      return null;
    }
  }

  /**
   * Store user's preferred location
   */
  async storePreferredLocation(
    userPhone: string,
    location: { lat: number; lng: number; text?: string }
  ): Promise<{ success: boolean; error?: string }> {
    return await this.storeMemory(userPhone, {
      memory_type: "location",
      memory_key: "preferred",
      memory_value: location,
      confidence: 0.9,
      source: "user_provided",
    });
  }

  /**
   * Store a past order
   */
  async storePastOrder(
    userPhone: string,
    order: {
      items: Array<{ name: string; quantity?: number }>;
      vendor_id?: string;
      vendor_name?: string;
      total_price?: number;
      currency?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const orderKey = `order_${Date.now()}`;
    return await this.storeMemory(userPhone, {
      memory_type: "past_order",
      memory_key: orderKey,
      memory_value: order,
      confidence: 1.0,
      source: "confirmed_order",
      // Expire after 90 days
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  /**
   * Store favorite vendor
   */
  async storeFavoriteVendor(
    userPhone: string,
    vendor: {
      vendor_id: string;
      vendor_name: string;
      category?: string;
      reason?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    return await this.storeMemory(userPhone, {
      memory_type: "favorite_vendor",
      memory_key: vendor.vendor_id,
      memory_value: vendor,
      confidence: 0.8,
      source: "inferred",
    });
  }

  /**
   * Store user preference (e.g., delivery vs pickup, budget range)
   */
  async storePreference(
    userPhone: string,
    preferenceKey: string,
    preferenceValue: unknown
  ): Promise<{ success: boolean; error?: string }> {
    return await this.storeMemory(userPhone, {
      memory_type: "preference",
      memory_key: preferenceKey,
      memory_value: { value: preferenceValue },
      confidence: 0.7,
      source: "inferred",
    });
  }

  /**
   * Get user context (all relevant memories for personalization)
   */
  async getUserContext(userPhone: string): Promise<{
    location?: { lat: number; lng: number; text?: string };
    past_orders: Array<Record<string, unknown>>;
    favorite_vendors: Array<Record<string, unknown>>;
    preferences: Record<string, unknown>;
  }> {
    try {
      const memories = await this.recallMemories(userPhone);

      const context = {
        location: undefined as { lat: number; lng: number; text?: string } | undefined,
        past_orders: [] as Array<Record<string, unknown>>,
        favorite_vendors: [] as Array<Record<string, unknown>>,
        preferences: {} as Record<string, unknown>,
      };

      for (const memory of memories) {
        switch (memory.memory_type) {
          case "location":
            if (memory.memory_key === "preferred") {
              context.location = memory.memory_value as {
                lat: number;
                lng: number;
                text?: string;
              };
            }
            break;
          case "past_order":
            context.past_orders.push(memory.memory_value);
            break;
          case "favorite_vendor":
            context.favorite_vendors.push(memory.memory_value);
            break;
          case "preference":
            context.preferences[memory.memory_key] = memory.memory_value;
            break;
        }
      }

      // Sort past orders by recency (use_count is a proxy)
      context.past_orders.sort((a, b) => {
        const aUseCount = memories.find(
          (m) => m.memory_type === "past_order" && m.memory_value === a
        )?.use_count || 0;
        const bUseCount = memories.find(
          (m) => m.memory_type === "past_order" && m.memory_value === b
        )?.use_count || 0;
        return bUseCount - aUseCount;
      });

      return context;
    } catch (error) {
      logStructuredEvent(
        "USER_MEMORY_GET_CONTEXT_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          userPhone: userPhone.slice(-4),
          correlationId: this.correlationId,
        },
        "error"
      );
      return {
        location: undefined,
        past_orders: [],
        favorite_vendors: [],
        preferences: {},
      };
    }
  }

  /**
   * Infer user preferences from past behavior
   */
  async inferPreferences(
    userPhone: string
  ): Promise<{
    typical_items?: Array<string>;
    typical_vendors?: Array<string>;
    delivery_preference?: "delivery" | "pickup";
    budget_range?: { min: number; max: number };
  }> {
    try {
      const context = await this.getUserContext(userPhone);

      const inferred: {
        typical_items?: Array<string>;
        typical_vendors?: Array<string>;
        delivery_preference?: "delivery" | "pickup";
        budget_range?: { min: number; max: number };
      } = {};

      // Infer typical items from past orders
      if (context.past_orders.length > 0) {
        const itemCounts: Record<string, number> = {};
        for (const order of context.past_orders) {
          const items = (order.items as Array<{ name: string }>) || [];
          for (const item of items) {
            itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
          }
        }

        // Get top 5 most frequent items
        inferred.typical_items = Object.entries(itemCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name]) => name);
      }

      // Infer typical vendors
      if (context.favorite_vendors.length > 0) {
        inferred.typical_vendors = context.favorite_vendors
          .slice(0, 3)
          .map((v) => (v.vendor_name as string) || (v.vendor_id as string));
      }

      // Infer delivery preference
      if (context.preferences.delivery_method) {
        inferred.delivery_preference = context.preferences.delivery_method as
          | "delivery"
          | "pickup";
      }

      // Infer budget range from past orders
      if (context.past_orders.length > 0) {
        const prices = context.past_orders
          .map((o) => o.total_price as number)
          .filter((p) => p != null && !isNaN(p));

        if (prices.length > 0) {
          inferred.budget_range = {
            min: Math.min(...prices),
            max: Math.max(...prices),
          };
        }
      }

      return inferred;
    } catch (error) {
      logStructuredEvent(
        "USER_MEMORY_INFER_PREFERENCES_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          userPhone: userPhone.slice(-4),
          correlationId: this.correlationId,
        },
        "error"
      );
      return {};
    }
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpiredMemories(): Promise<{ success: boolean; deletedCount?: number }> {
    try {
      const { data, error } = await this.supabase
        .from("agent_user_memory")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select("id");

      if (error) {
        logStructuredEvent(
          "USER_MEMORY_CLEANUP_ERROR",
          {
            error: error.message,
            correlationId: this.correlationId,
          },
          "error"
        );
        return { success: false };
      }

      const deletedCount = data?.length || 0;

      if (deletedCount > 0) {
        logStructuredEvent("USER_MEMORY_CLEANUP_COMPLETED", {
          deletedCount,
          correlationId: this.correlationId,
        });

        recordMetric("user.memory.cleanup", deletedCount);
      }

      return { success: true, deletedCount };
    } catch (error) {
      return { success: false };
    }
  }
}
