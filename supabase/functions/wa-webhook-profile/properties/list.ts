import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export async function listMyProperties(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: properties, error } = await ctx.supabase
    .from("properties")
    .select("id, title, location, price, property_type, status")
    .eq("owner_id", ctx.profileId)
    .order("created_at", { ascending: false})
    .limit(20);

  if (error) {
    console.error("Failed to fetch properties:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your properties. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }

  if (!properties || properties.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🏠 You don't have any property listings yet.\n\nList your first property to reach potential tenants or buyers!",
      [
        { id: IDS.CREATE_PROPERTY, title: "➕ List Property" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = properties.map((p) => {
    const priceInfo = p.price
      ? `${p.price.toLocaleString()} RWF`
      : "Price on request";

    return {
      id: `PROP::${p.id}`,
      title: p.title,
      description: `${p.location || "Location TBD"} • ${priceInfo}`,
    };
  });

  rows.push(
    {
      id: IDS.CREATE_PROPERTY,
      title: "➕ List New Property",
      description: "Add a new property listing",
    },
    {
      id: IDS.BACK_PROFILE,
      title: "← Back to Profile",
      description: "Return to profile menu",
    },
  );

  await sendListMessage(
    ctx,
    {
      title: "🏠 My Properties",
      body: `You have ${properties.length} property listing${properties.length === 1 ? "" : "s"}`,
      sectionTitle: "Properties",
      buttonText: "View",
      rows,
    },
    { emoji: "🏠" },
  );

  return true;
}

export async function handlePropertySelection(
  ctx: RouterContext,
  propertyId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: property, error } = await ctx.supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("owner_id", ctx.profileId)
    .single();

  if (error || !property) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Property not found or you don't have permission to view it.",
      [{ id: IDS.MY_PROPERTIES, title: "← Back to Properties" }],
    );
    return true;
  }

  const priceInfo = property.price
    ? `💰 ${property.price.toLocaleString()} RWF`
    : "💰 Price on request";

  const details = [
    `*${property.title}*`,
    property.property_type ? `Type: ${property.property_type}` : null,
    property.location ? `📍 ${property.location}` : null,
    priceInfo,
    property.bedrooms ? `🛏️ ${property.bedrooms} bedroom(s)` : null,
    property.bathrooms ? `🚿 ${property.bathrooms} bathroom(s)` : null,
    property.description ? `\n${property.description}` : null,
    property.status ? `\nStatus: ${property.status}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendListMessage(
    ctx,
    {
      title: "🏠 Property Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `EDIT_PROP::${propertyId}`,
          title: "✏️ Edit",
          description: "Update property information",
        },
        {
          id: `DELETE_PROP::${propertyId}`,
          title: "🗑️ Delete",
          description: "Remove this property listing",
        },
        {
          id: IDS.MY_PROPERTIES,
          title: "← Back",
          description: "Return to properties list",
        },
      ],
    },
    { emoji: "🏠" },
  );

  return true;
}
