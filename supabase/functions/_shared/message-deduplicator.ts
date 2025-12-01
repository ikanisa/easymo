/**
 * Message Deduplicator
 * 
 * Centralized service for detecting and preventing duplicate message processing
 * Uses wa_events table as source of truth for message tracking
 * 
 * Created: 2025-12-01
 * Part of: Platform cleanup - standardize deduplication across webhooks
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DeduplicationResult {
  isDuplicate: boolean;
  messageId: string;
  firstSeenAt?: string;
  processedCount: number;
}

export interface MessageMetadata {
  messageId: string;
  from: string;
  type: string;
  timestamp: string;
  body?: string;
}

/**
 * MessageDeduplicator - Prevents duplicate message processing
 */
export class MessageDeduplicator {
  private readonly tableName = "wa_events";
  
  constructor(private supabase: SupabaseClient) {}

  /**
   * Check if a message has already been processed
   * Returns true if message exists in wa_events table
   */
  async isDuplicate(messageId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("message_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (error) {
      console.error(JSON.stringify({
        event: "DEDUP_CHECK_ERROR",
        messageId,
        error: error.message,
      }));
      // On error, assume not duplicate to avoid blocking messages
      return false;
    }

    return !!data;
  }

  /**
   * Check and get full deduplication info
   */
  async checkMessage(messageId: string): Promise<DeduplicationResult> {
    const { data, count, error } = await this.supabase
      .from(this.tableName)
      .select("message_id, timestamp", { count: "exact" })
      .eq("message_id", messageId);

    if (error) {
      console.error(JSON.stringify({
        event: "DEDUP_CHECK_DETAILED_ERROR",
        messageId,
        error: error.message,
      }));
      return {
        isDuplicate: false,
        messageId,
        processedCount: 0,
      };
    }

    const isDuplicate = (count || 0) > 0;
    const firstSeenAt = data?.[0]?.timestamp;

    return {
      isDuplicate,
      messageId,
      firstSeenAt,
      processedCount: count || 0,
    };
  }

  /**
   * Record a message as processed
   * Stores in wa_events table for future deduplication checks
   */
  async recordMessage(metadata: MessageMetadata): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .insert({
        message_id: metadata.messageId,
        phone_number: metadata.from,
        event_type: metadata.type,
        timestamp: metadata.timestamp,
        body: metadata.body,
        status: "processed",
        created_at: new Date().toISOString(),
      });

    if (error) {
      // Check if it's a unique constraint violation (message already exists)
      if (error.code === "23505") { // PostgreSQL unique violation
        console.warn(JSON.stringify({
          event: "DEDUP_RACE_CONDITION",
          messageId: metadata.messageId,
          message: "Message already recorded (race condition)",
        }));
        return;
      }

      console.error(JSON.stringify({
        event: "DEDUP_RECORD_ERROR",
        messageId: metadata.messageId,
        error: error.message,
      }));
      // Don't throw - recording failure shouldn't block processing
    } else {
      console.log(JSON.stringify({
        event: "MESSAGE_RECORDED",
        messageId: metadata.messageId,
        from: metadata.from,
      }));
    }
  }

  /**
   * Check and record in a single operation
   * Returns true if message should be processed (not a duplicate)
   */
  async shouldProcess(metadata: MessageMetadata): Promise<boolean> {
    // First check if duplicate
    const result = await this.checkMessage(metadata.messageId);
    
    if (result.isDuplicate) {
      console.log(JSON.stringify({
        event: "DUPLICATE_MESSAGE_IGNORED",
        messageId: metadata.messageId,
        firstSeenAt: result.firstSeenAt,
        processedCount: result.processedCount,
      }));
      return false;
    }

    // Not a duplicate - record it
    await this.recordMessage(metadata);
    return true;
  }

  /**
   * Clean up old deduplication records
   * Call this periodically to prevent table bloat
   * 
   * @param daysToKeep - Number of days of history to keep (default: 30)
   */
  async cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("message_id");

    if (error) {
      console.error(JSON.stringify({
        event: "DEDUP_CLEANUP_ERROR",
        error: error.message,
      }));
      return 0;
    }

    const deletedCount = data?.length || 0;
    console.log(JSON.stringify({
      event: "DEDUP_CLEANUP_COMPLETE",
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    }));

    return deletedCount;
  }
}

/**
 * Convenience function for quick duplicate checks
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  messageId: string
): Promise<boolean> {
  const deduplicator = new MessageDeduplicator(supabase);
  return await deduplicator.isDuplicate(messageId);
}

/**
 * Convenience function for check + record pattern
 */
export async function processIfUnique(
  supabase: SupabaseClient,
  metadata: MessageMetadata
): Promise<boolean> {
  const deduplicator = new MessageDeduplicator(supabase);
  return await deduplicator.shouldProcess(metadata);
}
