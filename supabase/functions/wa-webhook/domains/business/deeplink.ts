import type { SupabaseClient } from "../../deps.ts";
import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { buildWaLink, buildQrUrl, generateReferralCode } from "../../utils/share.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { sendImageUrl } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { setState } from "../../state/store.ts";
import { recordRecentActivity } from "../locations/recent.ts";

const CODE_PREFIX = "BIZ";

async function generateUniqueBusinessCode(client: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateReferralCode();
    const { count, error } = await client
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("deeplink_code", candidate);
    if (error) throw error;
    if (!count) return candidate;
  }
  throw new Error("business_deeplink_code_collision");
}

async function ensureBusinessCode(
  ctx: RouterContext,
  businessId: string,
  currentCode?: string | null,
): Promise<string> {
  if (currentCode) return currentCode;
  const code = await generateUniqueBusinessCode(ctx.supabase);
  const { error } = await ctx.supabase
    .from("business")
    .update({ deeplink_code: code })
    .eq("id", businessId);
  if (error) throw error;
  return code;
}

export async function showBusinessDeeplinkShare(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const { data: business, error } = await ctx.supabase
    .from("business")
    .select(
      "id, name, location_text, category_name, tag, owner_whatsapp, bar_id, deeplink_code",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.deeplink.error"),
      [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }],
    );
    return true;
  }

  const code = await ensureBusinessCode(ctx, business.id, business.deeplink_code);
  const payload = `${CODE_PREFIX}:${code}`;
  const waLink = buildWaLink(payload);
  const qrUrl = buildQrUrl(waLink || payload);
  const caption = t(ctx.locale, "business.deeplink.qr_caption", {
    name: business.name,
  });
  try {
    await sendImageUrl(ctx.from, qrUrl, caption);
  } catch (_) {
    // ignore QR failures
  }

  const instructions = t(ctx.locale, "business.deeplink.share.instructions", {
    name: business.name,
    link: waLink,
    code: payload,
  });

  await sendButtonsMessage(
    ctx,
    instructions,
    [
      { id: IDS.BUSINESS_REFRESH_DEEPLINK, title: t(ctx.locale, "business.deeplink.button.refresh") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
    ],
  );
  return true;
}

export async function refreshBusinessDeeplink(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const newCode = await generateUniqueBusinessCode(ctx.supabase);
  await ctx.supabase
    .from("business")
    .update({ deeplink_code: newCode })
    .eq("id", businessId);
  return await showBusinessDeeplinkShare(ctx, businessId);
}

/**
 * Handle direct bar access via URL (easymo://waiter?bar_id=xxx&table=5)
 */
async function handleDirectBarAccess(
  ctx: RouterContext,
  barId: string,
  tableNumber: string | null,
): Promise<boolean> {
  const { data: bar } = await ctx.supabase
    .from("bars")
    .select("id, name, location_text, country, slug, whatsapp_number")
    .eq("id", barId)
    .maybeSingle();

  if (!bar) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.deeplink.invalid"),
      [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }],
    );
    return true;
  }

  // Initialize Waiter AI session
  if (ctx.profileId) {
    try {
      await ctx.supabase.from('ai_agent_sessions').upsert({
        phone: ctx.from,
        agent_type: 'waiter_agent',
        context: {
          barId: bar.id,
          restaurantId: bar.id,
          barName: bar.name,
          entryMethod: 'qr_scan',
          tableNumber: tableNumber,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: 'phone',
      });
    } catch (error) {
      console.error('Error creating Waiter AI session:', error);
    }
  }

  // Build response
  const lines: string[] = [];
  lines.push(`*${bar.name}*`);
  if (bar.location_text) {
    lines.push(t(ctx.locale, "business.deeplink.location", { location: bar.location_text }));
  }
  if (bar.whatsapp_number) {
    lines.push(t(ctx.locale, "business.deeplink.contact", { phone: bar.whatsapp_number }));
  }
  if (tableNumber) {
    lines.push(`📍 ${t(ctx.locale, "bars.table", { number: tableNumber })}`);
  }
  lines.push("");
  lines.push(t(ctx.locale, "business.deeplink.prompt.bar"));

  const buttons = [
    { id: IDS.BAR_VIEW_MENU, title: t(ctx.locale, "bars.buttons.view_menu") },
    { id: IDS.BAR_CHAT_WAITER, title: t(ctx.locale, "bars.buttons.chat_waiter") },
    { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
  ];

  // Store state
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "bar_detail",
      data: {
        barId: bar.id,
        barName: bar.name,
        barCountry: bar.country,
        barSlug: bar.slug,
        tableNumber,
      },
    });
    try {
      await recordRecentActivity(ctx, "bar_detail", bar.id, {
        barId: bar.id,
        barName: bar.name,
        barCountry: bar.country,
        barSlug: bar.slug,
        tableNumber,
      });
    } catch (_) {
      // ignore
    }
  }

  await sendButtonsMessage(ctx, lines.join("\n"), buttons);
  return true;
}

/**
 * Parse deeplink URL to extract code and parameters
 * Supports: BIZ:ABC123 or easymo://waiter?bar_id=xxx&table=5
 */
function parseDeeplinkUrl(rawInput: string): {
  code: string | null;
  barId: string | null;
  tableNumber: string | null;
} {
  const input = rawInput.trim();
  
  // Check if it's a URL format (easymo://waiter?...)
  if (input.startsWith('easymo://')) {
    try {
      const url = new URL(input);
      const params = url.searchParams;
      return {
        code: null,
        barId: params.get('bar_id'),
        tableNumber: params.get('table') || params.get('table_number'),
      };
    } catch {
      return { code: null, barId: null, tableNumber: null };
    }
  }
  
  // Otherwise treat as code
  return {
    code: input.toUpperCase(),
    barId: null,
    tableNumber: null,
  };
}

export async function handleBusinessDeeplinkCode(
  ctx: RouterContext,
  rawCode: string,
): Promise<boolean> {
  const parsed = parseDeeplinkUrl(rawCode);
  
  // Handle direct bar_id from URL
  if (parsed.barId) {
    return await handleDirectBarAccess(ctx, parsed.barId, parsed.tableNumber);
  }
  
  if (!parsed.code) return false;
  const code = parsed.code;
  
  const { data: business } = await ctx.supabase
    .from("business")
    .select(
      "id, name, location_text, owner_whatsapp, bar_id, category_name, tag",
    )
    .eq("deeplink_code", code)
    .maybeSingle();
  if (!business) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.deeplink.invalid"),
      [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }],
    );
    return true;
  }

  const lines: string[] = [];
  const buttons: { id: string; title: string }[] = [];

  if (business.bar_id) {
    const { data: bar } = await ctx.supabase
      .from("bars")
      .select("id, name, location_text, country, slug, whatsapp_number")
      .eq("id", business.bar_id)
      .maybeSingle();
    const displayName = bar?.name ?? business.name;
    const location = bar?.location_text ?? business.location_text ??
      t(ctx.locale, "business.deeplink.location_unknown");
    const whatsapp = bar?.whatsapp_number ?? business.owner_whatsapp ?? null;
    lines.push(`*${displayName}*`);
    lines.push(t(ctx.locale, "business.deeplink.location", { location }));
    if (whatsapp) {
      lines.push(t(ctx.locale, "business.deeplink.contact", { phone: whatsapp }));
    }
    lines.push("");
    lines.push(t(ctx.locale, "business.deeplink.prompt.bar"));

    if (bar?.id ?? business.bar_id) {
      const barIdToUse = bar?.id ?? business.bar_id;
      // Initialize Waiter AI session with bar context
      if (ctx.profileId) {
        try {
          // Get table number from parsed deeplink if available
          const tableNumber = (ctx as any).deeplinkTableNumber || null;
          
          // Create AI agent session with bar context
          await ctx.supabase.from('ai_agent_sessions').upsert({
            phone: ctx.from,
            agent_type: 'waiter_agent',
            context: {
              barId: barIdToUse,
              restaurantId: barIdToUse,
              barName: displayName,
              entryMethod: 'qr_scan',
              tableNumber: tableNumber,
            },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: 'phone',
          });
        } catch (error) {
          console.error('Error creating Waiter AI session:', error);
        }
      }

      buttons.push(
        { id: IDS.BAR_VIEW_MENU, title: t(ctx.locale, "bars.buttons.view_menu") },
        { id: IDS.BAR_CHAT_WAITER, title: t(ctx.locale, "bars.buttons.chat_waiter") },
      );

    if (ctx.profileId) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "bar_detail",
        data: {
          barId: bar?.id ?? business.bar_id,
          barName: displayName,
          barCountry: bar?.country ?? null,
          barSlug: bar?.slug ?? null,
        },
      });
      try {
        await recordRecentActivity(ctx, "bar_detail", bar?.id ?? business.bar_id, {
          barId: bar?.id ?? business.bar_id,
          barName: displayName,
          barCountry: bar?.country ?? null,
          barSlug: bar?.slug ?? null,
        });
      } catch (_) {
        // ignore
      }
    }
  } else {
    lines.push(`*${business.name}*`);
    if (business.location_text) {
      lines.push(
        t(ctx.locale, "business.deeplink.location", {
          location: business.location_text,
        }),
      );
    }
    if (business.owner_whatsapp) {
      lines.push(
        t(ctx.locale, "business.deeplink.contact", {
          phone: business.owner_whatsapp,
        }),
      );
    }
    lines.push("");
    lines.push(t(ctx.locale, "business.deeplink.prompt.generic"));
  }

  buttons.push({ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") });
  await sendButtonsMessage(ctx, lines.join("\n"), buttons);
  return true;
}
