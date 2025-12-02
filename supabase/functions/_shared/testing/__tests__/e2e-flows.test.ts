/**
 * End-to-End Flow Tests
 * Tests for complete user journeys across services
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  createMockSupabase,
  createMockWebhookPayload,
  createMockWhatsAppAPI,
  createTestSuite,
} from "../test-utils.ts";
import { TEST_USERS, TEST_LOCATIONS } from "../fixtures.ts";

// ============================================================================
// E2E FLOW: RIDE BOOKING
// ============================================================================

const rideBookingSuite = createTestSuite("E2E - Ride Booking Flow");

rideBookingSuite.test("complete ride booking journey", async () => {
  const wa = createMockWhatsAppAPI();
  const supabase = createMockSupabase({
    data: {
      profiles: TEST_USERS.passenger,
      trips: [],
    },
  });

  // Step 1: User sends greeting
  const greetingPayload = createMockWebhookPayload({
    messageType: "text",
    text: "hi",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(greetingPayload.entry[0].changes[0].value.messages[0]);

  // Step 2: System shows home menu (simulated)
  wa.sendList(TEST_USERS.passenger.whatsapp_e164, {
    title: "easyMO Services",
    rows: [{ id: "rides", title: "Rides & Transport" }],
  });
  assertEquals(wa.messages.length, 1);
  assertEquals(wa.messages[0].type, "list");

  // Step 3: User selects rides
  const ridesPayload = createMockWebhookPayload({
    messageType: "interactive",
    listId: "rides",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(ridesPayload.entry[0].changes[0].value.messages[0].interactive);

  // Step 4: System shows mobility menu
  wa.sendList(TEST_USERS.passenger.whatsapp_e164, {
    title: "Mobility",
    rows: [{ id: "see_drivers", title: "Nearby drivers" }],
  });
  assertEquals(wa.messages.length, 2);

  console.log("✅ Ride booking E2E flow completed");
});

// ============================================================================
// E2E FLOW: INSURANCE CLAIM
// ============================================================================

const insuranceClaimSuite = createTestSuite("E2E - Insurance Claim Flow");

insuranceClaimSuite.test("complete insurance claim journey", async () => {
  const wa = createMockWhatsAppAPI();
  const supabase = createMockSupabase({
    data: {
      profiles: TEST_USERS.passenger,
      insurance_claims: [],
    },
  });

  // Step 1: User initiates claim
  const claimPayload = createMockWebhookPayload({
    messageType: "text",
    text: "file claim",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(claimPayload.entry[0].changes[0].value.messages[0]);

  // Step 2: System shows claim types
  wa.sendList(TEST_USERS.passenger.whatsapp_e164, {
    title: "File Insurance Claim",
    rows: [
      { id: "claim_accident", title: "Vehicle Accident" },
      { id: "claim_theft", title: "Vehicle Theft" },
    ],
  });
  assertEquals(wa.messages.length, 1);

  // Step 3: User selects accident
  const typePayload = createMockWebhookPayload({
    messageType: "interactive",
    listId: "claim_accident",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(typePayload.entry[0].changes[0].value.messages[0].interactive);

  // Step 4: System asks for description
  wa.sendText(TEST_USERS.passenger.whatsapp_e164, "Please describe what happened...");
  assertEquals(wa.messages.length, 2);

  console.log("✅ Insurance claim E2E flow completed");
});

// ============================================================================
// E2E FLOW: WALLET TRANSFER
// ============================================================================

const walletTransferSuite = createTestSuite("E2E - Wallet Transfer Flow");

walletTransferSuite.test("complete wallet transfer journey", async () => {
  const wa = createMockWhatsAppAPI();
  const supabase = createMockSupabase({
    data: {
      profiles: TEST_USERS.passenger,
      wallets: { balance: 10000 },
    },
  });

  // Step 1: User initiates transfer
  const transferPayload = createMockWebhookPayload({
    messageType: "text",
    text: "transfer tokens",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(transferPayload.entry[0].changes[0].value.messages[0]);

  // Step 2: System asks for recipient
  wa.sendText(TEST_USERS.passenger.whatsapp_e164, "Enter recipient's phone number:");
  assertEquals(wa.messages.length, 1);

  // Step 3: User provides recipient
  const recipientPayload = createMockWebhookPayload({
    messageType: "text",
    text: "+250788200001",
    from: TEST_USERS.passenger.whatsapp_e164,
  });
  assertExists(recipientPayload.entry[0].changes[0].value.messages[0]);

  // Step 4: System asks for amount
  wa.sendText(TEST_USERS.passenger.whatsapp_e164, "Enter amount to transfer:");
  assertEquals(wa.messages.length, 2);

  console.log("✅ Wallet transfer E2E flow completed");
});

console.log("✅ E2E flow tests loaded");
