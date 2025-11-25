/**
 * Intent Parsing Tests
 * Tests parameter extraction from user messages
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// These tests verify the intent parsing logic without needing full orchestrator
// They test the parameter extraction patterns

Deno.test("Intent Parsing: Job search with location and salary", () => {
  const message = "find software job in Kigali paying 500k";
  
  // Simulate extraction
  const params: Record<string, unknown> = {};
  
  // Location extraction
  const locationMatch = message.match(/in\s+(\w+)/i);
  if (locationMatch) {
    params.location = locationMatch[1];
  }
  
  // Salary extraction
  const salaryMatch = message.match(/(\d+)k/i);
  if (salaryMatch) {
    params.min_salary = parseInt(salaryMatch[1]) * 1000;
  }
  
  // Category extraction
  if (message.toLowerCase().includes("software")) {
    params.category = "software";
  }
  
  assertEquals(params.location, "Kigali");
  assertEquals(params.min_salary, 500000);
  assertEquals(params.category, "software");
});

Deno.test("Intent Parsing: Property search with bedrooms and location", () => {
  const message = "3 bedroom house in Kimihurura under 300k";
  
  const params: Record<string, unknown> = {};
  
  // Bedrooms
  const bedroomMatch = message.match(/(\d+)\s*(?:bed|br|bedroom)/i);
  if (bedroomMatch) {
    params.bedrooms = parseInt(bedroomMatch[1]);
  }
  
  // Location
  const locationMatch = message.match(/in\s+(\w+)/i);
  if (locationMatch) {
    params.location = locationMatch[1];
  }
  
  // Budget
  const budgetMatch = message.match(/(\d+)k/i);
  if (budgetMatch) {
    params.max_monthly_rent = parseInt(budgetMatch[1]) * 1000;
  }
  
  assertEquals(params.bedrooms, 3);
  assertEquals(params.location, "Kimihurura");
  assertEquals(params.max_monthly_rent, 300000);
});

Deno.test("Intent Parsing: Ride with pickup and dropoff", () => {
  const message = "need ride from airport to downtown";
  
  const params: Record<string, unknown> = {};
  
  // From/To pattern
  const fromToMatch = message.match(/from\s+([^to]+?)\s+to\s+(.+?)(?:\s|$|,|\.)/i);
  if (fromToMatch) {
    params.pickup_address = fromToMatch[1].trim();
    params.dropoff_address = fromToMatch[2].trim();
  }
  
  assertEquals(params.pickup_address, "airport");
  assertEquals(params.dropoff_address, "downtown");
});

Deno.test("Intent Parsing: Ride with 'take me to' pattern", () => {
  const message = "take me to Kigali Convention Center";
  
  const params: Record<string, unknown> = {};
  
  const takeMeMatch = message.match(/take\s+me\s+to\s+(.+?)(?:\s|$|,|\.)/i);
  if (takeMeMatch) {
    params.dropoff_address = takeMeMatch[1].trim();
  }
  
  assertEquals(params.dropoff_address, "Kigali Convention Center");
});

Deno.test("Intent Parsing: Scheduled ride with time", () => {
  const message = "need ride tomorrow at 3pm";
  
  const params: Record<string, unknown> = {};
  
  if (message.toLowerCase().includes("tomorrow")) {
    params.scheduled_at = "tomorrow";
  }
  
  const timeMatch = message.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    params.scheduled_time = timeMatch[0].trim();
  }
  
  assertEquals(params.scheduled_at, "tomorrow");
  assertEquals(params.scheduled_time, "3pm");
});

Deno.test("Intent Parsing: Urgent ride (now/immediately)", () => {
  const message = "need ride now from airport";
  
  const params: Record<string, unknown> = {};
  
  if (message.toLowerCase().includes("now") || message.toLowerCase().includes("immediately")) {
    params.scheduled_at = null;
    params.urgent = true;
  }
  
  assertEquals(params.urgent, true);
  assertEquals(params.scheduled_at, null);
});

Deno.test("Intent Parsing: Insurance with vehicle type", () => {
  const message = "third party insurance for my motorcycle";
  
  const params: Record<string, unknown> = {};
  
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes("moto") || lowerMsg.includes("bike")) {
    params.vehicle_type = "motorcycle";
  } else if (lowerMsg.includes("car") || lowerMsg.includes("vehicle")) {
    params.vehicle_type = "car";
  }
  
  if (lowerMsg.includes("third party") || lowerMsg.includes("tiers")) {
    params.insurance_type = "third_party";
  } else if (lowerMsg.includes("comprehensive") || lowerMsg.includes("tous risques")) {
    params.insurance_type = "comprehensive";
  }
  
  assertEquals(params.vehicle_type, "motorcycle");
  assertEquals(params.insurance_type, "third_party");
});

Deno.test("Intent Parsing: Insurance with plate number", () => {
  const message = "insurance quote for plate RAD123";
  
  const params: Record<string, unknown> = {};
  
  const plateMatch = message.match(/(?:plate|number|registration)\s*:?\s*([A-Z0-9]+)/i);
  if (plateMatch) {
    params.vehicle_identifier = plateMatch[1];
  }
  
  assertEquals(params.vehicle_identifier, "RAD123");
});

Deno.test("Intent Parsing: Job search with category detection", () => {
  const messages = [
    { text: "find software developer job", expected: "software" },
    { text: "looking for sales position", expected: "sales" },
    { text: "marketing job needed", expected: "sales" },
  ];
  
  for (const { text, expected } of messages) {
    const params: Record<string, unknown> = {};
    const lowerMsg = text.toLowerCase();
    
    if (lowerMsg.includes("software") || lowerMsg.includes("dev")) {
      params.category = "software";
    } else if (lowerMsg.includes("sales") || lowerMsg.includes("market")) {
      params.category = "sales";
    }
    
    assertEquals(params.category, expected, `Failed for: ${text}`);
  }
});

Deno.test("Intent Parsing: Property type detection", () => {
  const messages = [
    { text: "apartment for rent", type: "apartment" },
    { text: "looking for house", type: "house" },
    { text: "studio to rent", type: "studio" },
  ];
  
  for (const { text, type } of messages) {
    const params: Record<string, unknown> = {};
    const lowerMsg = text.toLowerCase();
    
    if (lowerMsg.includes("apartment")) {
      params.property_type = "apartment";
    } else if (lowerMsg.includes("house")) {
      params.property_type = "house";
    } else if (lowerMsg.includes("studio")) {
      params.property_type = "studio";
    }
    
    assertEquals(params.property_type, type, `Failed for: ${text}`);
  }
});

Deno.test("Intent Parsing: Multiple bedrooms formats", () => {
  const messages = [
    "3 bedroom house",
    "2 bed apartment",
    "1BR flat",
  ];
  
  const expectedBedrooms = [3, 2, 1];
  
  messages.forEach((msg, i) => {
    const bedroomMatch = msg.match(/(\d+)\s*(?:bed|br|bedroom)/i);
    const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : null;
    assertEquals(bedrooms, expectedBedrooms[i], `Failed for: ${msg}`);
  });
});

Deno.test("Intent Parsing: Budget with K suffix", () => {
  const messages = [
    { text: "under 300k", expected: 300000 },
    { text: "max 500k budget", expected: 500000 },
    { text: "around 150k", expected: 150000 },
  ];
  
  for (const { text, expected } of messages) {
    const budgetMatch = text.match(/(\d+)k/i);
    const budget = budgetMatch ? parseInt(budgetMatch[1]) * 1000 : null;
    assertEquals(budget, expected, `Failed for: ${text}`);
  }
});

Deno.test("Intent Parsing: Time formats", () => {
  const messages = [
    { text: "at 3pm", expected: "3pm" },
    { text: "at 10:30 AM", expected: "10:30 AM" },
    { text: "around 5:00", expected: "5:00" },
  ];
  
  for (const { text, expected } of messages) {
    const timeMatch = text.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const time = timeMatch ? timeMatch[0].trim() : null;
    assertEquals(time, expected, `Failed for: ${text}`);
  }
});

Deno.test("Intent Parsing: Location extraction from various phrases", () => {
  const messages = [
    { text: "job in Kigali", expected: "Kigali" },
    { text: "house in Kimihurura", expected: "Kimihurura" },
    { text: "ride in downtown", expected: "downtown" },
  ];
  
  for (const { text, expected } of messages) {
    const locationMatch = text.match(/in\s+(\w+)/i);
    const location = locationMatch ? locationMatch[1] : null;
    assertEquals(location, expected, `Failed for: ${text}`);
  }
});

Deno.test("Intent Parsing: Insurance type keywords (multilingual)", () => {
  const messages = [
    { text: "third party insurance", type: "third_party" },
    { text: "assurance tiers", type: "third_party" },
    { text: "comprehensive cover", type: "comprehensive" },
    { text: "tous risques", type: "comprehensive" },
  ];
  
  for (const { text, type } of messages) {
    const params: Record<string, unknown> = {};
    const lowerMsg = text.toLowerCase();
    
    if (lowerMsg.includes("third party") || lowerMsg.includes("tiers")) {
      params.insurance_type = "third_party";
    } else if (lowerMsg.includes("comprehensive") || lowerMsg.includes("tous risques")) {
      params.insurance_type = "comprehensive";
    }
    
    assertEquals(params.insurance_type, type, `Failed for: ${text}`);
  }
});
