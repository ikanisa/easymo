/**
 * Send Push Notification via Expo Push Service
 * No Firebase required!
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotificationRequest {
  user_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "default" | "normal" | "high";
}

serve(async (req) => {
  try {
    // Verify service role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(Deno.env.get("SERVICE_ROLE_KEY")!)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const payload: NotificationRequest = await req.json();
    const { user_ids, title, body, data, priority = "high" } = payload;

    // Get push tokens from database
    let query = supabase
      .from("push_tokens")
      .select("token, platform, user_id");

    if (user_ids && user_ids.length > 0) {
      query = query.in("user_id", user_ids);
    }

    const { data: tokens, error: tokenError } = await query;

    if (tokenError) {
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No push tokens found" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Build Expo push messages
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      data: {
        ...data,
        user_id: t.user_id,
      },
      priority,
      channelId: "default",
    }));

    // Send to Expo Push Service
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Log results
    console.log(`Sent ${messages.length} notifications:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        sent: messages.length,
        results: result.data,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending notifications:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
