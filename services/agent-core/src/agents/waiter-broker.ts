export type WaiterBrokerIntent = "order_food" | "get_recommendations" | "ask_question" | "manage_order";

export type WaiterBrokerProfile = {
  id?: string;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type WaiterBrokerBar = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  country?: string | null;
  city_area?: string | null;
  cuisine_types?: string[] | null;
  price_range?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type WaiterBrokerMenu = {
  categories?: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      price?: number | null;
      currency?: string | null;
      description?: string | null;
      is_available?: boolean | null;
    }>;
  }>;
  specials?: string[] | null;
  popular_items?: string[] | null;
};

export type WaiterBrokerInput = {
  msisdn: string;
  message: string;
  intent: WaiterBrokerIntent;
  locale?: string | null;
  conversationId?: string | null;
  profile?: WaiterBrokerProfile;
  bar?: WaiterBrokerBar;
  menu?: WaiterBrokerMenu;
  orderContext?: {
    tableNumber?: string;
    currentOrder?: Array<{ item: string; quantity: number }>;
    totalAmount?: number;
  } | null;
};

export type WaiterBrokerBuildResult = {
  messages: Array<{ role: "system" | "user"; content: string }>;
  metadata: Record<string, string>;
  locale: string;
};

const WAITER_SYSTEM_PROMPT = `You are an expert digital waiter for EasyMO restaurants and bars. Your goal is to provide world-class hospitality via WhatsApp.

LANGUAGE RULES:
- Detect language from user profile: en, fr, rw, sw
- Greet in local language then match user's language
- English: Professional yet friendly
- French: "Bonjour!" then professional
- Kinyarwanda: "Muraho!" warm and welcoming
- Swahili: "Habari!" friendly and helpful

CONVERSATION STYLE:
- Be warm, enthusiastic about food/drinks
- Ask ONE question at a time
- Confirm each detail before proceeding
- Use food emojis (🍔🍕🍗🍺🍷)
- Build rapport (remember preferences)

NUMBERED OPTIONS:
- CRITICAL: Format ALL options with numbered emoji lists 1️⃣ 2️⃣ 3️⃣ etc
- Users reply with NUMBERS ONLY (1, 2, 3)
- Always end with: "Reply with number (1, 2, 3...) to select"
- Max 10 items per list (1️⃣-🔟)
- For 10+ items: Paginate with "Type 'more' for next 10"

MENU KNOWLEDGE:
- Know what's available, popular, new
- Suggest based on: time of day, weather, user history
- Highlight specials and promotions
- Warn about allergens if known
- Upsell complementary items (fries with burger, wine with steak)

ORDER TAKING FLOW:
1. Greet warmly, mention venue name
2. Ask: Dining in or delivery?
3. Present category options (numbered list)
4. Show items in category (numbered, with prices)
5. Confirm selection + quantity
6. Suggest add-ons/sides (numbered)
7. Ask for drinks (numbered)
8. Summarize order with total
9. Confirm payment method
10. Provide ETA

RECOMMENDATIONS FLOW:
1. Ask about mood/preferences
2. Present 3-5 options (numbered) with reasons
3. Explain dish highlights
4. Mention pairings (drink/side)
5. Share customer favorites

QUESTIONS FLOW:
1. Understand query (hours, location, WiFi, etc.)
2. Provide clear, helpful answer
3. Offer related suggestions

MANAGE ORDER FLOW:
1. Show current order items (numbered)
2. Options: Add more, Remove item, Change quantity, Cancel
3. Update and confirm new total

TONE: Enthusiastic, helpful, patient, food-passionate. Like a great waiter who knows the menu inside-out.

CONSTRAINTS:
- Don't hallucinate menu items not in context
- Don't quote prices not in menu data
- Don't promise delivery times without venue data
- Don't process payments (tell user to pay when served/delivered)`;

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are a sommelier/food expert for EasyMO venues.

EXPERTISE:
- Food pairings (wine + steak, beer + wings)
- Cultural preferences (halal, vegetarian, local cuisine)
- Occasion-based (date night, quick lunch, celebration)
- Budget-aware (suggest within price range)

RECOMMENDATION STYLE:
- Present 3 options in different price tiers
- Format: "1️⃣ Budget: X (price) - reason"
- Format: "2️⃣ Mid-range: Y (price) - reason"
- Format: "3️⃣ Premium: Z (price) - reason"
- Explain why each fits their request
- Mention preparation time if relevant

QUESTIONS TO ASK:
- What are you in the mood for?
- Any dietary restrictions?
- Spicy or mild?
- Quick bite or full meal?
- Trying something new or a favorite?

TONE: Expert but approachable, passionate about food, helpful not pushy.`;

const SYNONYM_LIMIT = 10;

const normalizeLocale = (value?: string | null) => {
  if (!value) return "en";
  return value.toLowerCase();
};

const readMetadataLocale = (profile?: WaiterBrokerProfile) => {
  if (!profile?.metadata || typeof profile.metadata !== "object") {
    return null;
  }
  const metadata = profile.metadata as Record<string, unknown>;
  const preferred = metadata.preferred_language;
  if (typeof preferred === "string" && preferred.trim().length >= 2) {
    return preferred;
  }
  if (typeof metadata.locale === "string") {
    return metadata.locale;
  }
  return null;
};

const describeBar = (bar?: WaiterBrokerBar | null) => {
  if (!bar) return null;
  const details: string[] = [];
  if (bar.name) details.push(`Venue: ${bar.name}`);
  if (bar.city_area) details.push(`Location: ${bar.city_area}`);
  if (bar.country) details.push(`Country: ${bar.country}`);
  if (bar.cuisine_types?.length) details.push(`Cuisine: ${bar.cuisine_types.join(", ")}`);
  if (bar.price_range) details.push(`Price Range: ${bar.price_range}`);
  return details.join(" | ");
};

const describeMenu = (menu?: WaiterBrokerMenu) => {
  if (!menu) return null;
  const parts: string[] = [];
  
  if (menu.categories?.length) {
    const categoryNames = menu.categories.map((cat) => cat.name).join(", ");
    parts.push(`Categories: ${categoryNames}`);
    
    // Sample items from each category (first 3)
    const sampleItems: string[] = [];
    menu.categories.forEach((cat) => {
      const items = cat.items.slice(0, 3).map((item) => {
        const price = item.price && item.currency
          ? ` (${item.price} ${item.currency})`
          : "";
        return `${item.name}${price}`;
      });
      if (items.length) {
        sampleItems.push(`${cat.name}: ${items.join(", ")}`);
      }
    });
    if (sampleItems.length) {
      parts.push(`Sample items: ${sampleItems.join(" | ")}`);
    }
  }
  
  if (menu.popular_items?.length) {
    parts.push(`Popular: ${menu.popular_items.join(", ")}`);
  }
  
  if (menu.specials?.length) {
    parts.push(`Today's Specials: ${menu.specials.join(", ")}`);
  }
  
  return parts.length ? parts.join("\n") : null;
};

const describeOrderContext = (orderContext?: WaiterBrokerInput["orderContext"]) => {
  if (!orderContext) return null;
  const parts: string[] = [];
  
  if (orderContext.tableNumber) {
    parts.push(`Table: ${orderContext.tableNumber}`);
  }
  
  if (orderContext.currentOrder?.length) {
    const items = orderContext.currentOrder
      .map((item) => `${item.quantity}x ${item.item}`)
      .join(", ");
    parts.push(`Current Order: ${items}`);
  }
  
  if (orderContext.totalAmount !== undefined) {
    parts.push(`Total: ${orderContext.totalAmount}`);
  }
  
  return parts.length ? parts.join(" | ") : null;
};

const describeUserProfile = (profile?: WaiterBrokerProfile) => {
  if (!profile?.metadata || typeof profile.metadata !== "object") {
    return null;
  }
  const data = profile.metadata as Record<string, unknown>;
  const attributes: string[] = [];
  
  if (typeof data.favorite_items === "object") {
    const favorites = data.favorite_items as string[];
    if (Array.isArray(favorites) && favorites.length) {
      attributes.push(`Favorites: ${favorites.slice(0, 5).join(", ")}`);
    }
  }
  
  if (typeof data.dietary_restrictions === "string") {
    attributes.push(`Dietary: ${data.dietary_restrictions}`);
  }
  
  if (typeof data.preferred_cuisine === "string") {
    attributes.push(`Prefers: ${data.preferred_cuisine}`);
  }
  
  if (typeof data.spice_level === "string") {
    attributes.push(`Spice: ${data.spice_level}`);
  }
  
  if (typeof data.average_order_value === "number") {
    attributes.push(`Avg Order: ${data.average_order_value}`);
  }
  
  return attributes.length ? attributes.join(" | ") : null;
};

const toMetadataRecord = (metadata: Record<string, string | null | undefined>): Record<string, string> => {
  return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
};

export function buildWaiterBrokerMessages(input: WaiterBrokerInput): WaiterBrokerBuildResult {
  const metadataLocale = readMetadataLocale(input.profile);
  const locale = normalizeLocale(input.locale ?? metadataLocale ?? input.profile?.locale ?? "en");
  
  const contextSections: string[] = [];
  
  const barInfo = describeBar(input.bar);
  if (barInfo) contextSections.push(barInfo);
  
  const menuInfo = describeMenu(input.menu);
  if (menuInfo) contextSections.push(menuInfo);
  
  const orderInfo = describeOrderContext(input.orderContext ?? undefined);
  if (orderInfo) contextSections.push(orderInfo);
  
  const profileInfo = describeUserProfile(input.profile);
  if (profileInfo) contextSections.push(profileInfo);
  
  const contextBlock = contextSections.length
    ? `Context:\n${contextSections.join("\n\n")}`
    : "Context: none";

  const systemPrompt = input.intent === "get_recommendations"
    ? RECOMMENDATIONS_SYSTEM_PROMPT
    : WAITER_SYSTEM_PROMPT;
  
  const tone = `Language: ${locale.toUpperCase()}. Be enthusiastic about food, use numbered lists for all options.`;
  
  const intentGuidance = getIntentGuidance(input.intent);
  
  const userPrompt = [
    contextBlock,
    intentGuidance,
    `User message (${locale}): """${input.message.trim()}"""`,
    "Respond with numbered options (1️⃣-🔟) where applicable. End with 'Reply with number to select'.",
  ].join("\n\n");

  const messages: WaiterBrokerBuildResult["messages"] = [
    { role: "system", content: `${systemPrompt}\n\n${tone}` },
    { role: "user", content: userPrompt },
  ];

  const metadata = toMetadataRecord({
    intent: input.intent,
    locale,
    msisdn: input.msisdn,
    conversationId: input.conversationId ?? undefined,
    profileId: input.profile?.id ?? undefined,
    barId: input.bar?.id ?? undefined,
    barName: input.bar?.name ?? undefined,
  });

  return { messages, metadata, locale };
}

function getIntentGuidance(intent: WaiterBrokerIntent): string {
  switch (intent) {
    case "order_food":
      return "User wants to order food/drinks. Follow the order-taking flow: greet, ask dining/delivery, show categories, confirm items, total.";
    case "get_recommendations":
      return "User wants food/drink recommendations. Ask about mood, preferences, budget. Present 3 options (budget/mid/premium) with reasons.";
    case "ask_question":
      return "User has a question about venue (hours, location, WiFi, etc.). Answer clearly and offer related suggestions.";
    case "manage_order":
      return "User wants to modify current order. Show current items (numbered), offer: add more, remove item, change quantity, cancel.";
    default:
      return "Assist user with their request.";
  }
}
