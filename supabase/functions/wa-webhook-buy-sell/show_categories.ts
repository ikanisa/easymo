/**
 * Show Buy & Sell categories as interactive list
 * Categories are fetched from buy_sell_categories table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendList } from "../_shared/wa-webhook-shared/wa/client.ts";

export async function showBuySellCategories(
  userPhone: string,
  userCountry: string = "RW"
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Fetch active categories from database
  const { data: categories, error } = await supabase
    .from("buy_sell_categories")
    .select("key, icon, name, country_specific_names, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !categories || categories.length === 0) {
    throw new Error("Failed to load categories");
  }

  // Get country-specific names or default
  const rows = categories.map(cat => {
    let displayName = cat.name;
    
    // Use country-specific name if available
    if (cat.country_specific_names?.[userCountry]?.name) {
      displayName = cat.country_specific_names[userCountry].name;
    }

    return {
      id: `category_${cat.key}`,
      title: displayName,
      description: `Find nearby ${cat.name.toLowerCase()}`,
    };
  });

  // Add AI chat option at the end
  rows.push({
    id: "chat_with_ai",
    title: "💬 Chat with AI Agent",
    description: "Ask me anything about products or services",
  });

  await sendList(userPhone, {
    body: "🛒 *Buy & Sell*\n\nChoose a category to find nearby businesses, or chat with our AI assistant:",
    button: "Select Category",
    sections: [
      {
        title: "Browse Categories",
        rows,
      },
    ],
  });
}
