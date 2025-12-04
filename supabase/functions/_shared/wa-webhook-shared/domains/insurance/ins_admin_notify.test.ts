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

// Test helper to simulate filtering contacts by type
type MockContact = {
  id: string;
  contact_type: string;
  contact_value: string;
  display_name: string;
  is_active: boolean;
};

function filterWhatsAppContacts(contacts: MockContact[]): MockContact[] {
  return contacts.filter(
    (c) => c.is_active && c.contact_type === "whatsapp"
  );
}

Deno.test("filterWhatsAppContacts returns only whatsapp contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", contact_type: "whatsapp", contact_value: "+250793094876", display_name: "Admin 1", is_active: true },
    { id: "2", contact_type: "email", contact_value: "admin@example.com", display_name: "Admin 2", is_active: true },
    { id: "3", contact_type: "whatsapp", contact_value: "+250788767816", display_name: "Admin 3", is_active: true },
    { id: "4", contact_type: "phone", contact_value: "+250795588248", display_name: "Admin 4", is_active: true },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 2);
  assertEquals(filtered[0].contact_value, "+250793094876");
  assertEquals(filtered[1].contact_value, "+250788767816");
});

Deno.test("filterWhatsAppContacts excludes inactive contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", contact_type: "whatsapp", contact_value: "+250793094876", display_name: "Admin 1", is_active: true },
    { id: "2", contact_type: "whatsapp", contact_value: "+250788767816", display_name: "Admin 2", is_active: false },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].contact_value, "+250793094876");
});

Deno.test("filterWhatsAppContacts returns empty array when no whatsapp contacts", () => {
  const contacts: MockContact[] = [
    { id: "1", contact_type: "email", contact_value: "admin@example.com", display_name: "Admin 1", is_active: true },
    { id: "2", contact_type: "phone", contact_value: "+250795588248", display_name: "Admin 2", is_active: true },
  ];

  const filtered = filterWhatsAppContacts(contacts);
  
  assertEquals(filtered.length, 0);
});

// Test helper to dedupe admins
type AdminTarget = { waId: string; name: string; contactId?: string };

function dedupeAdmins(targets: AdminTarget[]): AdminTarget[] {
  const map = new Map<string, AdminTarget>();
  for (const target of targets) {
    const id = normalizeAdminWaId(target.waId);
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, { ...target, waId: id });
    }
  }
  return Array.from(map.values());
}

Deno.test("dedupeAdmins removes duplicates by wa_id", () => {
  const targets: AdminTarget[] = [
    { waId: "+250793094876", name: "Admin 1", contactId: "1" },
    { waId: "250793094876", name: "Admin 1 Copy", contactId: "2" }, // Same number without +
    { waId: "+250788767816", name: "Admin 2", contactId: "3" },
  ];

  const deduped = dedupeAdmins(targets);
  
  assertEquals(deduped.length, 2);
});

Deno.test("dedupeAdmins keeps first occurrence of duplicate", () => {
  const targets: AdminTarget[] = [
    { waId: "+250793094876", name: "First Admin", contactId: "1" },
    { waId: "+250793094876", name: "Second Admin", contactId: "2" },
  ];

  const deduped = dedupeAdmins(targets);
  
  assertEquals(deduped.length, 1);
  assertEquals(deduped[0].name, "First Admin");
  assertEquals(deduped[0].contactId, "1");
});

console.log("✅ Insurance admin notification tests loaded");
