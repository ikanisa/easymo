import type { RouterContext } from "../types.ts";

function getThreadId(msg: any): string | null {
  if (msg?.context && typeof msg.context === "object") {
    const id = (msg.context as any).id;
    if (typeof id === "string" && id.trim().length) return id.trim();
  }
  return null;
}

export async function recordInbound(
  ctx: RouterContext,
  msg: any,
): Promise<void> {
  try {
    const { data: driver } = await ctx.supabase
      .from("drivers")
      .select("id")
      .eq("phone_e164", ctx.from)
      .maybeSingle();

    const waThreadId = getThreadId(msg);
    let conversationId: string | null = null;

    // Try create a conversation row (best-effort; allow duplicates gracefully)
    try {
      const { data: conv } = await ctx.supabase
        .from("conversations")
        .insert({
          channel: "whatsapp",
          role: driver ? "driver" : "user",
          driver_id: driver?.id ?? null,
          contact_id: null,
          wa_thread_id: waThreadId,
        })
        .select("id")
        .single();
      conversationId = conv?.id ?? null;
    } catch (_) {
      // Fall back to latest conversation by driver
      if (driver?.id) {
        const { data: latest } = await ctx.supabase
          .from("conversations")
          .select("id")
          .eq("driver_id", driver.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conversationId = latest?.id ?? null;
      }
    }

    // Insert message payload (dir=in)
    await ctx.supabase.from("messages").insert({
      conversation_id: conversationId,
      dir: "in",
      body: msg,
    });
  } catch (_) {
    // Non-blocking audit; ignore failures
  }
}
