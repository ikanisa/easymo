// Quincaillerie (Hardware Store) Sourcing Agent
// Handles hardware item search, image recognition, and price negotiation

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface QuincaillerieRequest {
  userId: string;
  location: { latitude: number; longitude: number };
  items?: string[]; // Item names
  itemImage?: string; // Image URL for OCR
  notes?: string;
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
    const request: QuincaillerieRequest = await req.json();
    
    console.log(JSON.stringify({
      event: "QUINCAILLERIE_AGENT_REQUEST",
      timestamp: new Date().toISOString(),
      userId: request.userId,
      hasImage: !!request.itemImage,
      itemCount: request.items?.length || 0,
    }));

    // Extract items from image if provided
    let items = request.items || [];
    if (request.itemImage && items.length === 0) {
      items = await extractItemsFromImage(request.itemImage);
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Please provide either item names or an image of the items you need.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        agent_type: "quincaillerie_sourcing",
        flow_type: "hardware_search",
        status: "searching",
        request_data: { items, location: request.location, notes: request.notes },
        deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Search for nearby quincailleries
    const { data: stores } = await supabase.rpc("search_nearby_vendors", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_vendor_type: "quincaillerie",
      p_radius_km: 10,
      p_limit: 10,
    });

    if (!stores || stores.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: "No hardware stores found in your area. Would you like to expand the search radius?",
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check inventory and get quotes from stores
    const quotes = await checkInventoryAndNegotiate(supabase, stores, items, session.id);

    // Filter stores with available items
    const availableQuotes = quotes.filter(q => q.offer_data.availableItems.length > 0)
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
          message: "No stores have the items you're looking for. Would you like me to search for alternatives?",
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

    const message = formatQuincaillerieOptions(availableQuotes, items);

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
    console.error(JSON.stringify({
      event: "QUINCAILLERIE_AGENT_ERROR",
      error: error.message,
      duration: Date.now() - startTime,
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractItemsFromImage(imageUrl: string): Promise<string[]> {
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
                text: "Extract all hardware/construction items from this image. List each item name clearly, one per line. If quantities are visible, include them.",
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
    
    // Parse items from response
    const items = content.split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith("#"))
      .map((line: string) => {
        // Remove numbers/bullets at start
        return line.replace(/^\d+[\.\)]\s*/, "").replace(/^[-*]\s*/, "");
      });

    return items;
  } catch (error) {
    console.error("Failed to extract items from image:", error);
    return [];
  }
}

async function checkInventoryAndNegotiate(
  supabase: any,
  stores: any[],
  items: string[],
  sessionId: string
): Promise<any[]> {
  const quotes = [];

  for (const store of stores) {
    // Simulate inventory check (in production, would query actual inventory)
    const availableItems = items.map(item => ({
      name: item,
      available: Math.random() > 0.3, // 70% availability simulation
      price: Math.round(1000 + Math.random() * 50000), // Random price 1000-51000 RWF
      quantity: Math.floor(Math.random() * 100) + 1,
    })).filter(item => item.available);

    if (availableItems.length === 0) continue;

    // Calculate total and apply negotiation
    const baseTotal = availableItems.reduce((sum, item) => sum + item.price, 0);
    const discountPercent = 0.05 + Math.random() * 0.10; // 5-15% discount
    const negotiatedTotal = Math.round(baseTotal * (1 - discountPercent));

    // Calculate score
    const score = calculateQuincaillerieScore(store, availableItems, items);

    // Create quote
    const { data: quote } = await supabase
      .from("agent_quotes")
      .insert({
        session_id: sessionId,
        vendor_id: store.id,
        vendor_type: "quincaillerie",
        vendor_name: store.name,
        offer_data: {
          availableItems: availableItems,
          unavailableItems: items.filter(i => !availableItems.some(a => a.name === i)),
          baseTotal,
          negotiatedTotal,
          discount: discountPercent * 100,
          distance: store.distance,
          eta: Math.round(store.distance * 3 + 10), // Rough ETA
        },
        status: "pending",
        ranking_score: score,
      })
      .select()
      .single();

    quotes.push(quote);
  }

  return quotes;
}

function calculateQuincaillerieScore(store: any, availableItems: any[], requestedItems: string[]): number {
  let score = 0;

  // Availability score (40%)
  const availabilityRatio = availableItems.length / requestedItems.length;
  score += availabilityRatio * 40;

  // Distance score (30%)
  if (store.distance < 2) score += 30;
  else if (store.distance < 5) score += 25;
  else if (store.distance < 10) score += 15;
  else score += 5;

  // Price score (20%) - Lower total is better
  const avgPrice = availableItems.reduce((sum, item) => sum + item.price, 0) / availableItems.length;
  const priceScore = Math.max(0, 20 - (avgPrice / 5000)); // Normalize around 10000 RWF
  score += Math.min(20, Math.max(0, priceScore));

  // Stock score (10%)
  const avgStock = availableItems.reduce((sum, item) => sum + item.quantity, 0) / availableItems.length;
  score += Math.min(10, avgStock / 10);

  return Math.round(score);
}

function formatQuincaillerieOptions(quotes: any[], requestedItems: string[]): string {
  let message = "🔨 *Hardware Store Options:*\n\n";

  quotes.forEach((quote: any, index: number) => {
    const offer = quote.offer_data;
    message += `*Option ${index + 1}: ${quote.vendor_name}*\n`;
    message += `📍 Distance: ${offer.distance?.toFixed(1)}km\n`;
    message += `⏱️ ETA: ~${offer.eta} mins\n`;
    message += `\n📦 *Available Items (${offer.availableItems.length}/${requestedItems.length}):*\n`;
    
    offer.availableItems.slice(0, 5).forEach((item: any) => {
      message += `  • ${item.name}: ${item.price} RWF (${item.quantity} in stock)\n`;
    });

    if (offer.availableItems.length > 5) {
      message += `  ... and ${offer.availableItems.length - 5} more items\n`;
    }

    if (offer.unavailableItems.length > 0) {
      message += `\n❌ *Unavailable:* ${offer.unavailableItems.slice(0, 3).join(", ")}`;
      if (offer.unavailableItems.length > 3) {
        message += ` +${offer.unavailableItems.length - 3} more`;
      }
      message += "\n";
    }

    message += `\n💰 *Total: ${offer.negotiatedTotal} RWF*`;
    if (offer.discount > 0) {
      message += ` (${offer.discount.toFixed(1)}% discount!)`;
    }
    message += `\n─────────────\n\n`;
  });

  message += "_Reply with the option number to contact this store (1, 2, or 3)_";

  return message;
}
