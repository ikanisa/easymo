// General Shops Agent
// Handles vendor search and conversational negotiation for all types of shops
// The agent finds nearby shops, chats with vendors on behalf of users, and negotiates prices

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface ShopsRequest {
  userId: string;
  action: "add" | "search";
  location: { latitude: number; longitude: number };
  address?: string;
  // For vendor search
  userIntent?: string; // What the user is looking for (e.g., "I need a haircut", "looking for car parts")
  shopCategory?: string; // Optional: saloon, supermarket, spareparts, liquorstore, cosmetics, etc
  maxBudget?: number;
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

interface VendorNegotiationContext {
  sessionId: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  userIntent: string;
  maxBudget?: number;
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
    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        agent_type: "shops",
        flow_type: "vendor_search",
        status: "searching",
        request_data: { 
          userIntent: request.userIntent,
          category: request.shopCategory, 
          location: request.location,
          address: request.address,
          maxBudget: request.maxBudget 
        },
        deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    console.log(JSON.stringify({
      event: "VENDOR_SEARCH_STARTED",
      sessionId: session.id,
      userIntent: request.userIntent,
      category: request.shopCategory,
    }));

    // Search for nearby shops (vendors)
    const { data: shops, error: searchError } = await supabase.rpc("search_nearby_shops", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_category: request.shopCategory || null,
      p_radius_km: 10,
      p_limit: 15,
    });

    if (searchError) throw searchError;

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

    // Score shops based on relevance and distance
    const scoredShops = shops.map((shop: any) => ({
      ...shop,
      relevanceScore: calculateShopRelevance(shop, request),
    })).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

    // Select top 5-10 vendors to contact
    const topShops = scoredShops.slice(0, 10);

    console.log(JSON.stringify({
      event: "VENDORS_IDENTIFIED",
      sessionId: session.id,
      vendorCount: topShops.length,
    }));

    // Initiate AI-powered conversational negotiation with vendors
    const negotiationResults = await negotiateWithVendors(
      supabase,
      session.id,
      topShops,
      request.userIntent || "",
      request.maxBudget
    );

    // Filter successful negotiations
    const successfulNegotiations = negotiationResults
      .filter(n => n.success && n.quote)
      .sort((a, b) => b.quote.ranking_score - a.quote.ranking_score)
      .slice(0, 3);

    if (successfulNegotiations.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: "The vendors I contacted don't have what you're looking for. Would you like me to search in a wider area?",
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session as completed
    await supabase
      .from("agent_sessions")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    // Format vendor options message
    const message = formatVendorOptions(successfulNegotiations);

    console.log(JSON.stringify({
      event: "VENDOR_SEARCH_COMPLETED",
      sessionId: session.id,
      successfulNegotiations: successfulNegotiations.length,
      duration: Date.now() - new Date(session.created_at).getTime(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        searchId: session.id,
        options: successfulNegotiations.map(n => n.quote),
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to search shops: ${error.message}`);
  }
}
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

// AI-powered conversational negotiation with vendors
async function negotiateWithVendors(
  supabase: any,
  sessionId: string,
  vendors: any[],
  userIntent: string,
  maxBudget?: number
): Promise<any[]> {
  const results = [];

  // Contact vendors in parallel (simulating WhatsApp conversations)
  const negotiations = vendors.map(vendor => 
    negotiateWithSingleVendor(supabase, sessionId, vendor, userIntent, maxBudget)
  );

  const settled = await Promise.allSettled(negotiations);

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      console.error("Negotiation failed:", result.reason);
      results.push({ success: false, error: result.reason });
    }
  }

  return results;
}

// Simulate AI agent having a conversation with a vendor
async function negotiateWithSingleVendor(
  supabase: any,
  sessionId: string,
  vendor: any,
  userIntent: string,
  maxBudget?: number
): Promise<any> {
  try {
    console.log(JSON.stringify({
      event: "NEGOTIATION_STARTED",
      sessionId,
      vendorId: vendor.id,
      vendorName: vendor.name,
    }));

    // Use OpenAI to simulate a natural conversation with the vendor
    // In production, this would be actual WhatsApp messages
    const negotiationPrompt = `You are an AI shopping assistant negotiating with a vendor on behalf of a customer.

Customer's need: ${userIntent}
Vendor: ${vendor.name}
Vendor categories: ${vendor.categories.join(", ")}
${maxBudget ? `Customer's budget: ${maxBudget} RWF` : ""}

Your task:
1. Greet the vendor politely
2. Ask if they have what the customer needs
3. Ask for pricing
4. Try to negotiate a fair price (aim for 5-10% discount if possible)
5. Maintain professional and friendly tone

Simulate a brief 2-3 message exchange and provide the outcome in JSON format.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are a skilled negotiator representing customers. Be respectful, brief, and effective." 
          },
          { role: "user", content: negotiationPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResult = await response.json();
    const negotiationOutcome = JSON.parse(aiResult.choices[0].message.content);

    // Log the negotiation conversation
    await supabase.from("vendor_quote_responses").insert({
      session_id: sessionId,
      vendor_id: vendor.id,
      request_message: negotiationOutcome.agentMessage || userIntent,
      response_message: negotiationOutcome.vendorResponse || "Available",
      response_parsed: negotiationOutcome,
    });

    // If vendor has what customer needs, create a quote
    if (negotiationOutcome.hasProduct || negotiationOutcome.available) {
      const basePrice = negotiationOutcome.originalPrice || estimatePrice(userIntent, vendor.categories);
      const negotiatedPrice = negotiationOutcome.negotiatedPrice || basePrice;
      const discount = basePrice > 0 ? ((basePrice - negotiatedPrice) / basePrice * 100) : 0;

      const { data: quote, error } = await supabase
        .from("agent_quotes")
        .insert({
          session_id: sessionId,
          vendor_id: vendor.id,
          vendor_type: "shop",
          vendor_name: vendor.name,
          offer_data: {
            originalPrice: basePrice,
            negotiatedPrice: negotiatedPrice,
            discount: discount,
            distance: vendor.distance,
            categories: vendor.categories,
            description: vendor.description,
            hasWhatsappCatalog: !!vendor.whatsapp_catalog_url,
            whatsappCatalogUrl: vendor.whatsapp_catalog_url,
            phone: vendor.phone,
            availability: negotiationOutcome.availability || "Available",
            notes: negotiationOutcome.notes || "",
            conversation: negotiationOutcome.conversation || [],
          },
          status: "pending",
          ranking_score: calculateVendorScore(vendor, negotiatedPrice, maxBudget),
        })
        .select()
        .single();

      if (error) throw error;

      console.log(JSON.stringify({
        event: "NEGOTIATION_SUCCESS",
        sessionId,
        vendorId: vendor.id,
        originalPrice: basePrice,
        negotiatedPrice,
        discount: discount.toFixed(1),
      }));

      return {
        success: true,
        quote,
        negotiationOutcome,
      };
    } else {
      console.log(JSON.stringify({
        event: "NEGOTIATION_FAILED",
        sessionId,
        vendorId: vendor.id,
        reason: negotiationOutcome.reason || "Product not available",
      }));

      return {
        success: false,
        reason: negotiationOutcome.reason || "Vendor doesn't have this product",
      };
    }
  } catch (error) {
    console.error("Single vendor negotiation error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function calculateShopRelevance(shop: any, request: ShopsRequest): number {
  let score = 0;

  // Category match (30%)
  if (request.shopCategory && shop.categories.includes(request.shopCategory)) {
    score += 30;
  } else if (request.shopCategory) {
    // Partial category match
    const lowerCategory = request.shopCategory.toLowerCase();
    const hasRelated = shop.categories.some((cat: string) => 
      cat.toLowerCase().includes(lowerCategory) || lowerCategory.includes(cat.toLowerCase())
    );
    score += hasRelated ? 15 : 5;
  } else {
    score += 10;
  }

  // Distance score (30%)
  if (shop.distance < 1) score += 30;
  else if (shop.distance < 2) score += 25;
  else if (shop.distance < 5) score += 20;
  else if (shop.distance < 10) score += 10;
  else score += 5;

  // Verification and trust (20%)
  if (shop.verified) score += 15;
  if (shop.rating >= 4.5) score += 5;

  // Availability (10%)
  if (shop.status === "active") score += 10;

  // Features (10%)
  if (shop.whatsapp_catalog_url) score += 5;
  if (shop.phone) score += 5;

  return Math.round(score);
}

function calculateVendorScore(vendor: any, negotiatedPrice: number, maxBudget?: number): number {
  let score = 0;

  // Price score (40%)
  if (maxBudget && negotiatedPrice <= maxBudget) {
    const priceRatio = negotiatedPrice / maxBudget;
    score += (1 - priceRatio) * 40;
  } else {
    score += 20;
  }

  // Distance score (30%)
  if (vendor.distance < 1) score += 30;
  else if (vendor.distance < 3) score += 25;
  else if (vendor.distance < 5) score += 20;
  else if (vendor.distance < 10) score += 10;
  else score += 5;

  // Rating score (15%)
  if (vendor.rating) {
    score += (vendor.rating / 5) * 15;
  }

  // Verified bonus (10%)
  if (vendor.verified) score += 10;

  // Features (5%)
  if (vendor.whatsapp_catalog_url) score += 5;

  return Math.round(score);
}

function estimatePrice(userIntent: string, categories: string[]): number {
  // Simple price estimation based on categories and intent
  const categoryPrices: Record<string, number> = {
    "saloon": 5000,
    "haircut": 3000,
    "supermarket": 10000,
    "spareparts": 15000,
    "liquorstore": 8000,
    "cosmetics": 7000,
    "hardware": 12000,
    "electronics": 20000,
    "clothing": 15000,
  };

  // Try to find matching category
  for (const [key, price] of Object.entries(categoryPrices)) {
    if (categories.some(cat => cat.toLowerCase().includes(key)) || 
        userIntent.toLowerCase().includes(key)) {
      return price;
    }
  }

  // Default estimate
  return 10000;
}

function formatVendorOptions(negotiations: any[]): string {
  let message = "🛍️ *I found these vendors for you:*\n\n";
  message += "_I've already chatted with them on your behalf!_\n\n";

  negotiations.forEach((neg: any, index: number) => {
    const quote = neg.quote;
    const offer = quote.offer_data;

    message += `*Option ${index + 1}: ${quote.vendor_name}*\n`;
    message += `📍 Distance: ${offer.distance?.toFixed(1)}km\n`;
    message += `🏪 ${offer.categories.slice(0, 2).join(", ")}\n`;

    if (offer.description) {
      message += `📝 ${offer.description.substring(0, 60)}...\n`;
    }

    message += `\n💰 *Price:* ${offer.negotiatedPrice} RWF`;
    
    if (offer.discount > 0) {
      message += ` ✨ _(${offer.discount.toFixed(0)}% discount negotiated!)_`;
    }
    message += "\n";

    if (offer.notes) {
      message += `💬 _"${offer.notes}"_\n`;
    }

    if (offer.hasWhatsappCatalog) {
      message += `📱 Has WhatsApp Catalog\n`;
    }

    message += `─────────────\n\n`;
  });

  message += "_Reply with the option number to contact this vendor (1, 2, or 3)_";

  return message;
}
