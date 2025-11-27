// General Shops Agent
// Handles general product search across all types of shops

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface ShopsRequest {
  userId: string;
  action: "add" | "search";
  location: { latitude: number; longitude: number };
  // For search
  products?: string[];
  productImage?: string;
  shopCategory?: string; // saloon, supermarket, spareparts, liquorstore, cosmetics, etc
  // For add shop
  shopData?: {
    name: string;
    description: string;
    categories: string[];
    whatsappCatalogUrl?: string;
    phone?: string;
    openingHours?: string;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const request: ShopsRequest = await req.json();
    
    console.log(JSON.stringify({
      event: "SHOPS_AGENT_REQUEST",
      timestamp: new Date().toISOString(),
      userId: request.userId,
      action: request.action,
    }));

    if (request.action === "add") {
      return await handleAddShop(supabase, request);
    } else {
      return await handleSearchShops(supabase, request);
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "SHOPS_AGENT_ERROR",
      error: error.message,
      duration: Date.now() - startTime,
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAddShop(supabase: any, request: ShopsRequest) {
  try {
    const { data: shop, error } = await supabase
      .from("shops")
      .insert({
        owner_id: request.userId,
        name: request.shopData!.name,
        description: request.shopData!.description,
        location: `POINT(${request.location.longitude} ${request.location.latitude})`,
        categories: request.shopData!.categories,
        whatsapp_catalog_url: request.shopData!.whatsappCatalogUrl,
        phone: request.shopData!.phone || null,
        opening_hours: request.shopData!.openingHours,
        status: "active",
        verified: false, // Requires admin verification
      })
      .select()
      .single();

    if (error) throw error;

    const message = `✅ *Shop Added Successfully!*\n\n` +
      `Your shop "${shop.name}" has been listed.\n` +
      `Shop ID: ${shop.id}\n` +
      `Categories: ${request.shopData!.categories.join(", ")}\n\n` +
      `Your shop will be visible to customers after verification (usually within 24 hours).\n\n` +
      `We'll notify you when customers are interested!`;

    return new Response(
      JSON.stringify({
        success: true,
        shopId: shop.id,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to add shop: ${error.message}`);
  }
}

async function handleSearchShops(supabase: any, request: ShopsRequest) {
  try {
    // Extract products from image if provided
    let products = request.products || [];
    if (request.productImage && products.length === 0) {
      products = await extractProductsFromImage(request.productImage);
    }

    if (products.length === 0 && !request.shopCategory) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Please provide either product names, an image, or shop category you're looking for.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        agent_type: "shops",
        flow_type: "product_search",
        status: "searching",
        request_data: { products, category: request.shopCategory, location: request.location },
        deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Search for nearby shops
    const { data: shops } = await supabase.rpc("search_nearby_shops", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_category: request.shopCategory || null,
      p_radius_km: 10,
      p_limit: 15,
    });

    if (!shops || shops.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: "No shops found in your area. Would you like to expand the search radius?",
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get product availability and quotes from shops
    const quotes = await checkShopInventory(supabase, shops, products, request.shopCategory, session.id);

    // Filter and rank quotes
    const availableQuotes = quotes
      .filter(q => {
        if (products.length > 0) {
          return q.offer_data.availableProducts.length > 0;
        }
        return true; // If searching by category only
      })
      .sort((a, b) => b.ranking_score - a.ranking_score)
      .slice(0, 3);

    if (availableQuotes.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: "No shops have the products you're looking for. Would you like me to search in a different category?",
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session
    await supabase
      .from("agent_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.id);

    const message = formatShopsOptions(availableQuotes, products, request.shopCategory);

    return new Response(
      JSON.stringify({
        success: true,
        searchId: session.id,
        options: availableQuotes,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to search shops: ${error.message}`);
  }
}

async function extractProductsFromImage(imageUrl: string): Promise<string[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all product names from this shopping list or product image. List each product clearly, one per line. Include quantities if visible.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const products = content.split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith("#"))
      .map((line: string) => line.replace(/^\d+[\.\)]\s*/, "").replace(/^[-*]\s*/, ""));

    return products;
  } catch (error) {
    console.error("Failed to extract products from image:", error);
    return [];
  }
}

async function checkShopInventory(
  supabase: any,
  shops: any[],
  products: string[],
  category: string | undefined,
  sessionId: string
): Promise<any[]> {
  const quotes = [];

  for (const shop of shops) {
    let availableProducts = [];
    let shopInfo: any = {
      hasWhatsappCatalog: !!shop.whatsapp_catalog_url,
      categories: shop.categories,
    };

    if (products.length > 0) {
      // Simulate product availability
      availableProducts = products.map(product => ({
        name: product,
        available: Math.random() > 0.4, // 60% availability
        price: Math.round(500 + Math.random() * 20000), // 500-20500 RWF
        inStock: Math.floor(Math.random() * 50) + 1,
      })).filter(p => p.available);
    }

    // Calculate score
    const score = calculateShopScore(shop, availableProducts, products, category);

    // If category search only, include shops even without product data
    if (products.length === 0 || availableProducts.length > 0) {
      const baseTotal = availableProducts.reduce((sum, p) => sum + p.price, 0);
      const discount = Math.random() * 0.08; // 0-8% discount
      const negotiatedTotal = Math.round(baseTotal * (1 - discount));

      const { data: quote } = await supabase
        .from("agent_quotes")
        .insert({
          session_id: sessionId,
          vendor_id: shop.id,
          vendor_type: "shop",
          vendor_name: shop.name,
          offer_data: {
            ...shopInfo,
            availableProducts,
            unavailableProducts: products.filter(p => !availableProducts.some(a => a.name === p)),
            baseTotal,
            negotiatedTotal,
            discount: discount * 100,
            distance: shop.distance,
            description: shop.description,
          },
          status: "pending",
          ranking_score: score,
        })
        .select()
        .single();

      quotes.push(quote);
    }
  }

  return quotes;
}

function calculateShopScore(shop: any, availableProducts: any[], requestedProducts: string[], category?: string): number {
  let score = 0;

  // Category match (20%)
  if (category && shop.categories.includes(category)) {
    score += 20;
  } else if (category) {
    score += 5;
  } else {
    score += 10; // No specific category
  }

  // Product availability (30%)
  if (requestedProducts.length > 0) {
    const availabilityRatio = availableProducts.length / requestedProducts.length;
    score += availabilityRatio * 30;
  } else {
    score += 20; // Category search
  }

  // Distance score (25%)
  if (shop.distance < 1) score += 25;
  else if (shop.distance < 3) score += 20;
  else if (shop.distance < 5) score += 15;
  else if (shop.distance < 10) score += 10;
  else score += 5;

  // WhatsApp catalog bonus (10%)
  if (shop.whatsapp_catalog_url) score += 10;

  // Verified shop bonus (10%)
  if (shop.verified) score += 10;

  // Price competitiveness (5%)
  if (availableProducts.length > 0) {
    const avgPrice = availableProducts.reduce((sum, p) => sum + p.price, 0) / availableProducts.length;
    score += Math.max(0, 5 - (avgPrice / 4000));
  }

  return Math.round(score);
}

function formatShopsOptions(quotes: any[], products: string[], category?: string): string {
  let message = "🛍️ *Shop Options Found:*\n\n";

  quotes.forEach((quote: any, index: number) => {
    const offer = quote.offer_data;
    message += `*Option ${index + 1}: ${quote.vendor_name}*\n`;
    message += `📍 Distance: ${offer.distance?.toFixed(1)}km\n`;
    message += `🏪 Categories: ${offer.categories.join(", ")}\n`;

    if (offer.description) {
      message += `📝 ${offer.description.substring(0, 80)}${offer.description.length > 80 ? "..." : ""}\n`;
    }

    if (offer.hasWhatsappCatalog) {
      message += `📱 Has WhatsApp Catalog\n`;
    }

    if (products.length > 0) {
      message += `\n📦 *Available Products (${offer.availableProducts.length}/${products.length}):*\n`;
      offer.availableProducts.slice(0, 5).forEach((product: any) => {
        message += `  • ${product.name}: ${product.price} RWF\n`;
      });

      if (offer.availableProducts.length > 5) {
        message += `  ... and ${offer.availableProducts.length - 5} more\n`;
      }

      if (offer.unavailableProducts.length > 0) {
        message += `\n❌ *Not available:* ${offer.unavailableProducts.slice(0, 2).join(", ")}`;
        if (offer.unavailableProducts.length > 2) {
          message += ` +${offer.unavailableProducts.length - 2} more`;
        }
        message += "\n";
      }

      if (offer.negotiatedTotal > 0) {
        message += `\n💰 *Total: ${offer.negotiatedTotal} RWF*`;
        if (offer.discount > 0) {
          message += ` (${offer.discount.toFixed(1)}% discount)`;
        }
      }
    }

    message += `\n─────────────\n\n`;
  });

  message += "_Reply with the option number to contact this shop (1, 2, or 3)_";

  return message;
}
