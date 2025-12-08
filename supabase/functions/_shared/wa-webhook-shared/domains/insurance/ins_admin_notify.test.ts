/**
 * Tests for Insurance Admin Notification
 */
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Test helper to normalize admin WhatsApp ID
function normalizeAdminWaId(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

Deno.test("normalizeAdminWaId handles valid phone numbers", () => {
  assertEquals(normalizeAdminWaId("+250793094876"), "+250793094876");
  assertEquals(normalizeAdminWaId("250793094876"), "250793094876");
  assertEquals(normalizeAdminWaId("+250 793 094 876"), "+250793094876");
  assertEquals(normalizeAdminWaId("  +250793094876  "), "+250793094876");
});

Deno.test("normalizeAdminWaId returns empty string for invalid inputs", () => {
  assertEquals(normalizeAdminWaId(null), "");
  assertEquals(normalizeAdminWaId(undefined), "");
  assertEquals(normalizeAdminWaId(""), "");
  assertEquals(normalizeAdminWaId("   "), "");
});

Deno.test("normalizeAdminWaId rejects non-phone values", () => {
  // Email addresses should result in empty string (only digits extracted)
  const emailResult = normalizeAdminWaId("admin@example.com");
  assertEquals(emailResult.length < 8, true, "Email should not produce valid wa_id");
});

// Test helper to simulate filtering contacts by channel
type MockContact = {
  id: string;
  channel: 'whatsapp' | 'email';
  destination: string;
  display_name: string;
  is_active: boolean;
};

function filterWhatsAppContacts(contacts: MockContact[]): MockContact[] {
  return contacts.filter(
    (c) => c.is_active && c.channel === "whatsapp"
  );
}

Deno.test("filterWhatsAppContacts returns only whatsapp contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", channel: "whatsapp", destination: "+250793094876", display_name: "Admin 1", is_active: true },
    { id: "2", channel: "email", destination: "admin@example.com", display_name: "Admin 2", is_active: true },
    { id: "3", channel: "whatsapp", destination: "+250788767816", display_name: "Admin 3", is_active: true },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 2);
  assertEquals(filtered[0].destination, "+250793094876");
  assertEquals(filtered[1].destination, "+250788767816");
});

Deno.test("filterWhatsAppContacts excludes inactive contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", channel: "whatsapp", destination: "+250793094876", display_name: "Admin 1", is_active: true },
    { id: "2", channel: "whatsapp", destination: "+250788767816", display_name: "Admin 2", is_active: false },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].destination, "+250793094876");
});

Deno.test("filterWhatsAppContacts returns empty array when no whatsapp contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", channel: "email", destination: "admin@example.com", display_name: "Admin 1", is_active: true },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 0);
});

console.log("✅ Insurance admin notification tests loaded");
