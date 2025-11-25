import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendButtonsMessage, sendListMessage, sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";

/**
 * Show user's own property listings
 */
export async function showMyProperties(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) {
    await sendButtonsMessage(ctx, "Please create a profile first.", [
      { id: IDS.BACK_HOME, title: "← Home" }
    ]);
    return false;
  }

  const { data: properties, error } = await ctx.supabase
    .from('property_listings')
    .select('*')
    .eq('user_id', ctx.profileId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    await logStructuredEvent("PROPERTY_MY_LISTINGS_ERROR", {
      userId: ctx.profileId,
      error: error.message
    }, "error");

    await sendButtonsMessage(
      ctx,
      "❌ Error loading your listings. Please try again.",
      [{ id: IDS.BACK_HOME, title: "← Home" }]
    );
    return false;
  }

  if (!properties || properties.length === 0) {
    await sendButtonsMessage(
      ctx,
      "📋 *No Active Listings*\n\n" +
      "You haven't listed any properties yet.\n\n" +
      "Ready to list your first property?",
      [
        { id: "PROPERTY_ADD", title: "➕ Add Property" },
        { id: IDS.BACK_HOME, title: "← Home" }
      ]
    );
    return true;
  }

  const rows = properties.map(p => ({
    id: `VIEW_PROP::${p.id}`,
    title: p.title || `${p.bedrooms}BR ${p.property_type}`,
    description: `${p.price} ${p.currency}/${p.listing_type} - ${p.status}`
  }));

  rows.push({ id: IDS.BACK_HOME, title: "← Back to Home" });

  await sendListMessage(ctx, {
    title: "🏠 My Property Listings",
    body: `You have ${properties.length} active listing(s).\n\nSelect a property to view details or manage it.`,
    sectionTitle: "Your Listings",
    buttonText: "View Property",
    rows
  });

  await logStructuredEvent("PROPERTY_MY_LISTINGS_VIEWED", {
    userId: ctx.profileId,
    count: properties.length
  });

  return true;
}

/**
 * Show details of a specific property
 */
export async function handlePropertyDetailView(
  ctx: RouterContext,
  propertyId: string
): Promise<boolean> {
  const { data: property, error } = await ctx.supabase
    .from('property_listings')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    await sendButtonsMessage(ctx, "❌ Property not found.", [
      { id: IDS.BACK_HOME, title: "← Home" }
    ]);
    return false;
  }

  const isOwner = property.user_id === ctx.profileId;

  let message = `🏠 *${property.title || 'Property Listing'}*\n\n`;
  message += `📍 Location: ${property.location || 'Not specified'}\n`;
  message += `🛏️ Bedrooms: ${property.bedrooms || 'N/A'}\n`;
  message += `🚿 Bathrooms: ${property.bathrooms || 'N/A'}\n`;
  message += `📐 Size: ${property.size_sqm ? property.size_sqm + ' sqm' : 'N/A'}\n`;
  message += `💰 Price: ${property.price} ${property.currency}/${property.listing_type}\n`;
  message += `🏷️ Type: ${property.property_type}\n`;
  
  if (property.amenities && property.amenities.length > 0) {
    message += `\n✨ Amenities:\n${property.amenities.map(a => `• ${a}`).join('\n')}\n`;
  }
  
  if (property.description) {
    message += `\n📝 Description:\n${property.description}\n`;
  }

  message += `\n📅 Listed: ${new Date(property.created_at).toLocaleDateString()}`;
  message += `\n📊 Status: ${property.status}`;

  const buttons = isOwner ? [
    { id: `PROP_EDIT::${propertyId}`, title: "✏️ Edit" },
    { id: `PROP_STATUS::${propertyId}`, title: "📋 Status" },
    { id: `PROP_DELETE::${propertyId}`, title: "🗑️ Remove" },
    { id: "MY_PROPERTIES", title: "← My Listings" }
  ] : [
    { id: `PROP_INQUIRE::${propertyId}`, title: "✉️ Contact Owner" },
    { id: IDS.BACK_HOME, title: "← Back" }
  ];

  await sendButtonsMessage(ctx, message, buttons);

  await logStructuredEvent("PROPERTY_DETAIL_VIEWED", {
    userId: ctx.profileId,
    propertyId,
    isOwner
  });

  return true;
}

/**
 * Handle property actions (edit, delete, mark rented)
 */
export async function handlePropertyActions(
  ctx: RouterContext,
  propertyId: string,
  action: "edit" | "delete" | "mark_rented" | "mark_available"
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Verify ownership
  const { data: property, error } = await ctx.supabase
    .from('property_listings')
    .select('id, user_id, status, title')
    .eq('id', propertyId)
    .eq('user_id', ctx.profileId)
    .single();

  if (error || !property) {
    await sendButtonsMessage(
      ctx,
      "❌ Property not found or you don't have permission to modify it.",
      [{ id: IDS.BACK_HOME, title: "← Home" }]
    );
    return false;
  }

  switch (action) {
    case "delete":
      await ctx.supabase
        .from('property_listings')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', propertyId);

      await sendButtonsMessage(
        ctx,
        "✅ *Property Removed*\n\nYour listing has been removed from the marketplace.",
        [
          { id: "MY_PROPERTIES", title: "📋 My Listings" },
          { id: IDS.BACK_HOME, title: "← Home" }
        ]
      );

      await logStructuredEvent("PROPERTY_DELETED", {
        userId: ctx.profileId,
        propertyId
      });
      break;

    case "mark_rented":
      await ctx.supabase
        .from('property_listings')
        .update({ status: 'rented', updated_at: new Date().toISOString() })
        .eq('id', propertyId);

      await sendButtonsMessage(
        ctx,
        "✅ *Property Marked as Rented*\n\nThe listing is now marked as rented and won't appear in searches.",
        [
          { id: "MY_PROPERTIES", title: "📋 My Listings" },
          { id: IDS.BACK_HOME, title: "← Home" }
        ]
      );

      await logStructuredEvent("PROPERTY_MARKED_RENTED", {
        userId: ctx.profileId,
        propertyId
      });
      break;

    case "mark_available":
      await ctx.supabase
        .from('property_listings')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', propertyId);

      await sendButtonsMessage(
        ctx,
        "✅ *Property Marked as Available*\n\nThe listing is now active again.",
        [
          { id: "MY_PROPERTIES", title: "📋 My Listings" },
          { id: IDS.BACK_HOME, title: "← Home" }
        ]
      );

      await logStructuredEvent("PROPERTY_MARKED_AVAILABLE", {
        userId: ctx.profileId,
        propertyId
      });
      break;

    case "edit":
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_edit_menu",
        data: { propertyId }
      });

      await sendButtonsMessage(
        ctx,
        `✏️ *Edit Property*\n\nWhat would you like to update for:\n${property.title || 'this property'}?`,
        [
          { id: "PROP_EDIT_PRICE", title: "💰 Update Price" },
          { id: "PROP_EDIT_DESC", title: "📝 Update Description" },
          { id: "PROP_EDIT_AMENITIES", title: "✨ Update Amenities" },
          { id: `VIEW_PROP::${propertyId}`, title: "← Back to Property" }
        ]
      );
      break;
  }

  return true;
}

/**
 * Send inquiry to property owner
 */
export async function sendPropertyInquiry(
  ctx: RouterContext,
  propertyId: string,
  message?: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get property details
  const { data: property } = await ctx.supabase
    .from('property_listings')
    .select('id, user_id, contact_info, title, bedrooms, price, currency, listing_type')
    .eq('id', propertyId)
    .single();

  if (!property) {
    await sendButtonsMessage(ctx, "❌ Property not found.", [
      { id: IDS.BACK_HOME, title: "← Home" }
    ]);
    return false;
  }

  // Save inquiry
  const { error: inquiryError } = await ctx.supabase
    .from('property_inquiries')
    .insert({
      property_id: propertyId,
      inquirer_phone: ctx.from,
      inquirer_user_id: ctx.profileId,
      message: message || "I'm interested in this property. Please contact me.",
      status: 'pending'
    });

  if (inquiryError) {
    await logStructuredEvent("PROPERTY_INQUIRY_ERROR", {
      userId: ctx.profileId,
      propertyId,
      error: inquiryError.message
    }, "error");

    await sendButtonsMessage(ctx, "❌ Failed to send inquiry. Please try again.", [
      { id: IDS.BACK_HOME, title: "← Home" }
    ]);
    return false;
  }

  // Get inquirer profile
  const { data: inquirerProfile } = await ctx.supabase
    .from('profiles')
    .select('name, wa_id')
    .eq('user_id', ctx.profileId)
    .single();

  // Notify property owner
  const ownerPhone = property.contact_info?.phone || ctx.from;
  const inquirerName = inquirerProfile?.name || 'Someone';
  
  await sendText(
    ownerPhone,
    `🏠 *New Property Inquiry!*\n\n` +
    `${inquirerName} is interested in your property:\n` +
    `"${property.title || `${property.bedrooms}BR ${property.listing_type}`}"\n\n` +
    `💰 Listed at: ${property.price} ${property.currency}\n\n` +
    `${message ? `Message: "${message}"\n\n` : ''}` +
    `📞 Contact: ${ctx.from}\n\n` +
    `Reply to this message to contact them directly.`
  );

  await sendButtonsMessage(
    ctx,
    "✅ *Inquiry Sent!*\n\n" +
    "The property owner has been notified and will contact you shortly.\n\n" +
    "You'll receive a message when they respond.",
    [{ id: IDS.BACK_HOME, title: "← Home" }]
  );

  await logStructuredEvent("PROPERTY_INQUIRY_SENT", {
    userId: ctx.profileId,
    propertyId,
    inquirerPhone: ctx.from
  });

  return true;
}

/**
 * Prompt for inquiry message
 */
export async function promptInquiryMessage(
  ctx: RouterContext,
  propertyId: string
): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: "property_inquiry",
    data: { propertyId }
  });

  await sendText(
    ctx.from,
    "✉️ *Contact Property Owner*\n\n" +
    "Type your message to the owner:\n\n" +
    "(Or type 'skip' to send a standard inquiry message)"
  );

  return true;
}

/**
 * Handle inquiry message input
 */
export async function handleInquiryMessage(
  ctx: RouterContext,
  propertyId: string,
  message: string
): Promise<boolean> {
  if (message.toLowerCase() === 'skip' || message.toLowerCase() === 'cancel') {
    return await sendPropertyInquiry(ctx, propertyId);
  }

  return await sendPropertyInquiry(ctx, propertyId, message);
}
