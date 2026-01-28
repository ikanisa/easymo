import { getWebSupabaseClient } from "./client";

export type NotificationTarget = {
  target_type: "seller_session" | "buyer_session" | "vendor" | "lead";
  target_id: string;
  channel: "web" | "whatsapp" | "email";
  payload: Record<string, unknown>;
};

export async function queueNotifications(postId: string, targets: NotificationTarget[]): Promise<string[]> {
  if (!targets.length) return [];
  if (targets.length > 10) {
    throw new Error("notification_target_limit_exceeded");
  }

  const client = getWebSupabaseClient();
  const payload = targets.map((target) => ({
    post_id: postId,
    target_type: target.target_type,
    target_id: target.target_id,
    channel: target.channel,
    payload: target.payload,
    status: "queued",
  }));

  const { data, error } = await client.from("web_notifications").insert(payload).select("id");
  if (error) {
    throw new Error(`queue_notifications_failed:${error.message}`);
  }

  return (data ?? []).map((row) => String(row.id));
}

export async function queueListingNotifications(listingId: string, targets: NotificationTarget[]): Promise<string[]> {
  if (!targets.length) return [];
  if (targets.length > 10) {
    throw new Error("notification_target_limit_exceeded");
  }

  const client = getWebSupabaseClient();
  const payload = targets.map((target) => ({
    post_id: null,
    listing_id: listingId,
    target_type: target.target_type,
    target_id: target.target_id,
    channel: target.channel,
    payload: target.payload,
    status: "queued",
  }));

  const { data, error } = await client.from("web_notifications").insert(payload).select("id");
  if (error) {
    throw new Error(`queue_listing_notifications_failed:${error.message}`);
  }

  return (data ?? []).map((row) => String(row.id));
}
