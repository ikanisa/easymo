/**
 * Handle category selection and location sharing
 * State is persisted in Supabase user_metadata
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";

interface CategoryState {
  selectedCategory: string;
  categoryName: string;
  waitingForLocation: boolean;
  timestamp: number;
}

// Helper to get/set user state in database
async function getUserState(userPhone: string): Promise<CategoryState | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("phone", userPhone)
    .single();

  if (profile?.metadata?.buy_sell_state) {
    const state = profile.metadata.buy_sell_state as CategoryState;
    // Check if state is not older than 10 minutes
    if (Date.now() - state.timestamp < 10 * 60 * 1000) {
      return state;
    }
  }

  return null;
}

async function setUserState(userPhone: string, state: CategoryState | null): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  if (state) {
    state.timestamp = Date.now();
  }

  await supabase
    .from("profiles")
    .update({
      metadata: state ? { buy_sell_state: state } : {}
    })
    .eq("phone", userPhone);
}

export async function handleCategorySelection(
  userPhone: string,
  categoryId: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Extract category key from ID (format: "category_pharmacies")
  const categoryKey = categoryId.replace("category_", "");

  // Fetch category details from database
  const { data: category } = await supabase
    .from("buy_sell_categories")
    .select("key, name, icon")
    .eq("key", categoryKey)
    .single();

  if (!category) {
    await sendText(userPhone, "❌ Category not found. Please try again.");
    return;
  }

  // Store user state in database
  await setUserState(userPhone, {
    selectedCategory: category.key,
    categoryName: category.name,
    waitingForLocation: true,
    timestamp: Date.now(),
  });

  // Ask for location
  await sendText(
    userPhone,
    `📍 *Finding ${category.icon} ${category.name}*\n\n` +
    `Please share your location so I can find nearby businesses.\n\n` +
    `Tap the 📎 attachment icon → Location → Send your current location`
  );
}

export async function handleLocationShared(
  userPhone: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const state = await getUserState(userPhone);
  
  if (!state || !state.waitingForLocation) {
    await sendText(userPhone, "Please select a category first.");
    return;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Call search_businesses_nearby function
  const { data: businesses, error } = await supabase.rpc(
    "search_businesses_nearby",
    {
      p_latitude: latitude,
      p_longitude: longitude,
      p_category: state.selectedCategory,
      p_radius_km: 10,
      p_limit: 9,
    }
  );

  if (error || !businesses || businesses.length === 0) {
    await sendText(
      userPhone,
      `😔 No ${state.categoryName.toLowerCase()} found within 10km.\n\n` +
      `Try searching in a different area or contact support.`
    );
    userStates.delete(userPhone);
    return;
  }

  // Format results
  let message = `📍 *Found ${businesses.length} ${state.categoryName}* near you:\n\n`;

  businesses.forEach((biz: any, index: number) => {
    const distance = biz.distance_km
      ? `${biz.distance_km.toFixed(1)}km away`
      : "Distance unknown";
    
    message += `${index + 1}. *${biz.name}*\n`;
    message += `   📍 ${distance}\n`;
    if (biz.address) message += `   📫 ${biz.address}\n`;
    if (biz.phone) message += `   📞 ${biz.phone}\n`;
    if (biz.owner_whatsapp) message += `   💬 WhatsApp: ${biz.owner_whatsapp}\n`;
    message += `\n`;
  });

  message += `\nTap a business to see more details or call directly!`;

  await sendText(userPhone, message);

  // Clear state from database
}

