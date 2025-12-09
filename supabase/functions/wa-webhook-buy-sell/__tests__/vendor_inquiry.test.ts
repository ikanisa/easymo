/**
 * Vendor Inquiry Tools Tests
 *
 * Tests for the vendor outreach concierge functionality:
 * - Business search with tags
 * - Vendor inquiry creation
 * - Reply parsing
 * - Shortlist formatting
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Import the functions we're testing - since some need Supabase, we test helpers directly
// and mock the database calls

// =====================================================
// Response Parsing Tests
// =====================================================

/**
 * Parse vendor response text into structured data.
 * Duplicated here for testing since the original is internal to the module.
 */
function parseVendorResponse(text: string): {
  status: "yes" | "no" | "other";
  price?: number;
  quantity?: number;
  notes?: string;
} {
  const normalized = text.trim().toLowerCase();

  // Check for negative responses
  if (/^(no|oya|nope|sorry|don't have|hatubifite|nta)/i.test(normalized)) {
    return { status: "no" };
  }

  // Check for positive responses
  const yesMatch = normalized.match(/^(yes|yee|yeah|ndabifite|tubifite)\s*([\d,.]+)?\s*([\d,.]+)?/i);
  if (yesMatch) {
    const price = yesMatch[2] ? parseFloat(yesMatch[2].replace(/,/g, "")) : undefined;
    const quantity = yesMatch[3] ? parseInt(yesMatch[3].replace(/,/g, ""), 10) : undefined;

    return {
      status: "yes",
      price: price && !isNaN(price) ? price : undefined,
      quantity: quantity && !isNaN(quantity) ? quantity : undefined,
    };
  }

  // Check if message contains numbers (might be price/availability info)
  const numberMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (numberMatch && numberMatch.length > 0) {
    return {
      status: "other",
      notes: text.slice(0, 200),
    };
  }

  return { status: "other", notes: text.slice(0, 200) };
}

Deno.test("parseVendorResponse - parses YES with price and quantity", () => {
  const result = parseVendorResponse("YES 1500 2");
  assertEquals(result.status, "yes");
  assertEquals(result.price, 1500);
  assertEquals(result.quantity, 2);
});

Deno.test("parseVendorResponse - parses YES with only price", () => {
  const result = parseVendorResponse("YES 2500");
  assertEquals(result.status, "yes");
  assertEquals(result.price, 2500);
  assertEquals(result.quantity, undefined);
});

Deno.test("parseVendorResponse - parses YES with comma-formatted price", () => {
  const result = parseVendorResponse("YES 15,000 5");
  assertEquals(result.status, "yes");
  assertEquals(result.price, 15000);
  assertEquals(result.quantity, 5);
});

Deno.test("parseVendorResponse - parses plain YES", () => {
  const result = parseVendorResponse("YES");
  assertEquals(result.status, "yes");
  assertEquals(result.price, undefined);
  assertEquals(result.quantity, undefined);
});

Deno.test("parseVendorResponse - parses Kinyarwanda YEE", () => {
  const result = parseVendorResponse("YEE 1500 2");
  assertEquals(result.status, "yes");
  assertEquals(result.price, 1500);
  assertEquals(result.quantity, 2);
});

Deno.test("parseVendorResponse - parses NO", () => {
  const result = parseVendorResponse("NO");
  assertEquals(result.status, "no");
});

Deno.test("parseVendorResponse - parses Kinyarwanda OYA", () => {
  const result = parseVendorResponse("OYA");
  assertEquals(result.status, "no");
});

Deno.test("parseVendorResponse - parses 'Sorry, don't have'", () => {
  const result = parseVendorResponse("Sorry, don't have it");
  assertEquals(result.status, "no");
});

Deno.test("parseVendorResponse - parses unclear message with numbers as other", () => {
  const result = parseVendorResponse("We have it at 1500 per unit");
  assertEquals(result.status, "other");
  assertExists(result.notes);
});

Deno.test("parseVendorResponse - parses unclear message without numbers", () => {
  const result = parseVendorResponse("Let me check and get back to you");
  assertEquals(result.status, "other");
  assertExists(result.notes);
});

Deno.test("parseVendorResponse - handles case insensitivity", () => {
  const resultYes = parseVendorResponse("yes 1000");
  assertEquals(resultYes.status, "yes");
  assertEquals(resultYes.price, 1000);

  const resultNo = parseVendorResponse("NO");
  assertEquals(resultNo.status, "no");
});

// =====================================================
// Shortlist Formatting Tests
// =====================================================

interface VendorReply {
  businessId: string;
  businessName: string;
  businessPhone: string;
  status: "yes" | "no" | "other" | "pending";
  price?: number;
  quantity?: number;
  notes?: string;
  distanceKm?: number;
  responseTimeSec?: number;
}

/**
 * Format confirmed vendor replies into a user-friendly message
 * Duplicated here for testing
 */
function formatVendorShortlist(
  replies: VendorReply[],
  requestSummary: string,
): string {
  const confirmed = replies.filter((r) => r.status === "yes");

  if (confirmed.length === 0) {
    const pending = replies.filter((r) => r.status === "pending").length;
    if (pending > 0) {
      return (
        `⏳ *Still Waiting for Replies*\n\n` +
        `I've contacted ${replies.length} businesses about:\n` +
        `"${requestSummary}"\n\n` +
        `${pending} haven't replied yet. Check back in a minute!`
      );
    }

    return (
      `😔 *No Matches Found*\n\n` +
      `None of the ${replies.length} businesses I contacted have "${requestSummary}" in stock right now.\n\n` +
      `Would you like me to:\n` +
      `• Search a wider area\n` +
      `• Try different businesses\n` +
      `• Show the directory anyway`
    );
  }

  let message = `✅ *${confirmed.length} Business${confirmed.length > 1 ? "es" : ""} Confirmed*\n\n`;
  message += `These have "${requestSummary}" right now:\n\n`;

  confirmed.forEach((vendor, index) => {
    message += `${index + 1}. *${vendor.businessName}*`;
    if (vendor.distanceKm) {
      message += ` – ${vendor.distanceKm.toFixed(1)}km away`;
    }
    message += "\n";

    if (vendor.price) {
      message += `   💰 ${vendor.price.toLocaleString()} RWF`;
      if (vendor.quantity) {
        message += ` (${vendor.quantity} available)`;
      }
      message += "\n";
    }

    if (vendor.notes) {
      message += `   📝 ${vendor.notes}\n`;
    }

    message += "\n";
  });

  message += `\n📞 Tap to chat directly:\n`;
  confirmed.forEach((vendor) => {
    const cleanPhone = vendor.businessPhone.replace(/\D/g, "");
    message += `[Chat ${vendor.businessName}](https://wa.me/${cleanPhone})\n`;
  });

  return message;
}

Deno.test("formatVendorShortlist - formats confirmed vendors correctly", () => {
  const replies: VendorReply[] = [
    {
      businessId: "1",
      businessName: "CityCare Pharmacy",
      businessPhone: "+250788111111",
      status: "yes",
      price: 1500,
      quantity: 10,
      distanceKm: 0.4,
    },
    {
      businessId: "2",
      businessName: "Remera Meds",
      businessPhone: "+250788222222",
      status: "yes",
      price: 1400,
      distanceKm: 1.2,
    },
    {
      businessId: "3",
      businessName: "Health Plus",
      businessPhone: "+250788333333",
      status: "no",
    },
  ];

  const result = formatVendorShortlist(replies, "Paracetamol 500mg");

  // Should mention 2 confirmed
  assertEquals(result.includes("2 Businesses Confirmed"), true);
  assertEquals(result.includes("CityCare Pharmacy"), true);
  assertEquals(result.includes("Remera Meds"), true);
  assertEquals(result.includes("Health Plus"), false); // No should be excluded
  assertEquals(result.includes("1,500 RWF"), true);
  assertEquals(result.includes("0.4km away"), true);
  assertEquals(result.includes("wa.me/250788111111"), true);
});

Deno.test("formatVendorShortlist - shows pending message when waiting", () => {
  const replies: VendorReply[] = [
    {
      businessId: "1",
      businessName: "Shop A",
      businessPhone: "+250788111111",
      status: "pending",
    },
    {
      businessId: "2",
      businessName: "Shop B",
      businessPhone: "+250788222222",
      status: "pending",
    },
  ];

  const result = formatVendorShortlist(replies, "Laptop");

  assertEquals(result.includes("Still Waiting"), true);
  assertEquals(result.includes("2 haven't replied"), true);
});

Deno.test("formatVendorShortlist - shows no matches message", () => {
  const replies: VendorReply[] = [
    {
      businessId: "1",
      businessName: "Shop A",
      businessPhone: "+250788111111",
      status: "no",
    },
    {
      businessId: "2",
      businessName: "Shop B",
      businessPhone: "+250788222222",
      status: "no",
    },
  ];

  const result = formatVendorShortlist(replies, "Rare item");

  assertEquals(result.includes("No Matches Found"), true);
  assertEquals(result.includes("2 businesses"), true);
});

Deno.test("formatVendorShortlist - handles single confirmed vendor", () => {
  const replies: VendorReply[] = [
    {
      businessId: "1",
      businessName: "Only Shop",
      businessPhone: "+250788111111",
      status: "yes",
      price: 5000,
    },
  ];

  const result = formatVendorShortlist(replies, "Item X");

  assertEquals(result.includes("1 Business Confirmed"), true);
  assertEquals(result.includes("Only Shop"), true);
});

// =====================================================
// Consent Message Generation Tests
// =====================================================

interface BusinessSearchResult {
  id: string;
  name: string;
  distanceKm?: number;
}

function generateConsentMessage(
  businesses: BusinessSearchResult[],
  requestSummary: string,
  maxToContact: number = 4,
): { text: string; buttons: Array<{ id: string; title: string }> } {
  const count = Math.min(businesses.length, maxToContact);

  let text = `🔍 *Found ${businesses.length} matching businesses!*\n\n`;
  text += `Looking for: "${requestSummary}"\n\n`;

  if (businesses.length <= 3) {
    businesses.forEach((biz, i) => {
      const distance = biz.distanceKm ? ` (${biz.distanceKm.toFixed(1)}km)` : "";
      text += `${i + 1}. ${biz.name}${distance}\n`;
    });
    text += "\n";
  } else {
    const nearest = businesses[0];
    const furthest = businesses[businesses.length - 1];
    text += `📍 Nearest: ${nearest.name}`;
    if (nearest.distanceKm) text += ` (${nearest.distanceKm.toFixed(1)}km)`;
    text += `\n📍 Furthest: ${furthest.name}`;
    if (furthest.distanceKm) text += ` (${furthest.distanceKm.toFixed(1)}km)`;
    text += "\n\n";
  }

  text += `I can message up to ${count} of them on your behalf to check if they have what you need.\n\n`;
  text += `_Do you want me to contact them for you?_`;

  return {
    text,
    buttons: [
      { id: "concierge_contact_yes", title: "✅ Yes, contact them" },
      { id: "concierge_change_request", title: "✏️ Change request" },
      { id: "concierge_show_list", title: "📋 Just show list" },
    ],
  };
}

Deno.test("generateConsentMessage - lists all businesses when 3 or fewer", () => {
  const businesses: BusinessSearchResult[] = [
    { id: "1", name: "Shop A", distanceKm: 0.5 },
    { id: "2", name: "Shop B", distanceKm: 1.0 },
  ];

  const result = generateConsentMessage(businesses, "Test item");

  assertEquals(result.text.includes("Found 2 matching"), true);
  assertEquals(result.text.includes("1. Shop A (0.5km)"), true);
  assertEquals(result.text.includes("2. Shop B (1.0km)"), true);
  assertEquals(result.buttons.length, 3);
});

Deno.test("generateConsentMessage - shows summary when more than 3 businesses", () => {
  const businesses: BusinessSearchResult[] = [
    { id: "1", name: "Nearest Shop", distanceKm: 0.3 },
    { id: "2", name: "Shop B", distanceKm: 1.0 },
    { id: "3", name: "Shop C", distanceKm: 2.0 },
    { id: "4", name: "Furthest Shop", distanceKm: 5.0 },
  ];

  const result = generateConsentMessage(businesses, "Test item");

  assertEquals(result.text.includes("Found 4 matching"), true);
  assertEquals(result.text.includes("Nearest: Nearest Shop"), true);
  assertEquals(result.text.includes("Furthest: Furthest Shop"), true);
  assertEquals(result.text.includes("up to 4 of them"), true);
});

Deno.test("generateConsentMessage - respects maxToContact parameter", () => {
  const businesses: BusinessSearchResult[] = [
    { id: "1", name: "Shop A" },
    { id: "2", name: "Shop B" },
    { id: "3", name: "Shop C" },
    { id: "4", name: "Shop D" },
    { id: "5", name: "Shop E" },
  ];

  const result = generateConsentMessage(businesses, "Test item", 3);

  assertEquals(result.text.includes("up to 3 of them"), true);
});

// =====================================================
// Vendor Message Generation Tests
// =====================================================

interface VendorOutreachParams {
  requestSummary: string;
  structuredPayload: {
    item?: string;
    quantity?: number;
    budget?: number;
    timeframe?: string;
    pickupArea?: string;
    brand?: string;
  };
  language?: string;
}

function generateVendorOutreachMessage(
  params: VendorOutreachParams,
  businessName: string,
): string {
  const payload = params.structuredPayload;
  const lang = params.language || "en";

  const details: string[] = [];
  if (payload.item) details.push(payload.item);
  if (payload.quantity) details.push(`Qty: ${payload.quantity}`);
  if (payload.budget) details.push(`Budget: ${payload.budget.toLocaleString()} RWF`);
  if (payload.timeframe) details.push(`When: ${payload.timeframe}`);
  if (payload.brand) details.push(`Brand: ${payload.brand}`);

  const detailsText = details.length > 0 ? details.join("\n") : params.requestSummary;

  if (lang === "rw" || lang === "kinyarwanda") {
    return (
      `Muraho ${businessName},\n\n` +
      `Ndi EasyMO assistant. Umukiriya uri hafi ${payload.pickupArea || "Kigali"} arashaka:\n\n` +
      `${detailsText}\n\n` +
      `Mufite ibi bintu ubu?\n\n` +
      `Subiza:\n` +
      `• YEE igiciro umubare - niba mufite (urugero: YEE 1500 2)\n` +
      `• OYA - niba mudafite`
    );
  }

  return (
    `Hi ${businessName},\n\n` +
    `This is the EasyMO assistant.\n` +
    `A client near ${payload.pickupArea || "your area"} is looking for:\n\n` +
    `${detailsText}\n\n` +
    `Do you have this in stock right now?\n\n` +
    `Please reply:\n` +
    `• YES price quantity – if you have it (e.g., YES 1500 2)\n` +
    `• NO – if you don't have it`
  );
}

Deno.test("generateVendorOutreachMessage - generates English message with all fields", () => {
  const result = generateVendorOutreachMessage(
    {
      requestSummary: "Paracetamol 500mg",
      structuredPayload: {
        item: "Paracetamol 500mg",
        quantity: 2,
        budget: 5000,
        timeframe: "today",
        pickupArea: "Kacyiru",
        brand: "Panadol",
      },
    },
    "CityCare Pharmacy",
  );

  assertEquals(result.includes("Hi CityCare Pharmacy"), true);
  assertEquals(result.includes("EasyMO assistant"), true);
  assertEquals(result.includes("Paracetamol 500mg"), true);
  assertEquals(result.includes("Qty: 2"), true);
  assertEquals(result.includes("Budget: 5,000 RWF"), true);
  assertEquals(result.includes("When: today"), true);
  assertEquals(result.includes("Brand: Panadol"), true);
  assertEquals(result.includes("near Kacyiru"), true);
  assertEquals(result.includes("YES price quantity"), true);
});

Deno.test("generateVendorOutreachMessage - generates Kinyarwanda message", () => {
  const result = generateVendorOutreachMessage(
    {
      requestSummary: "Paracetamol",
      structuredPayload: {
        item: "Paracetamol",
        pickupArea: "Remera",
      },
      language: "rw",
    },
    "Farumasi",
  );

  assertEquals(result.includes("Muraho Farumasi"), true);
  assertEquals(result.includes("EasyMO assistant"), true);
  assertEquals(result.includes("hafi Remera"), true);
  assertEquals(result.includes("YEE igiciro umubare"), true);
  assertEquals(result.includes("OYA"), true);
});

Deno.test("generateVendorOutreachMessage - uses requestSummary when no structured details", () => {
  const result = generateVendorOutreachMessage(
    {
      requestSummary: "school laptop under 400k",
      structuredPayload: {},
    },
    "Tech Shop",
  );

  assertEquals(result.includes("school laptop under 400k"), true);
});
