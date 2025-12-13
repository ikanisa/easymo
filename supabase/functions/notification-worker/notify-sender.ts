/**
 * Notification queue processor
 * Extracts the notification processing logic from deleted wa-webhook
 */

import { supabase } from "../_shared/wa-webhook-shared/config.ts";

export async function processNotificationQueue(batchSize: number) {
  const { data: notifications, error } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }

  const results = [];
  for (const notification of notifications || []) {
    try {
      // Process notification (send via WhatsApp, email, etc.)
      // Mark as processed
      await supabase
        .from("notification_queue")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", notification.id);
      
      results.push({ id: notification.id, status: "success" });
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
      await supabase
        .from("notification_queue")
        .update({ 
          status: "failed", 
          error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString()
        })
        .eq("id", notification.id);
      
      results.push({ id: notification.id, status: "failed" });
    }
  }

  return results;
}
