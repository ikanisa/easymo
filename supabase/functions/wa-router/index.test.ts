import { assertEquals, assertMatch } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.env.set("WA_APP_SECRET", "test_secret");
Deno.env.set("DEST_EASYMO_URL", "https://api.easymo.app/chat");
Deno.env.set("DEST_INSURANCE_URL", "https://api.easymo.app/insurance");
Deno.env.set("DEST_BASKET_URL", "https://api.easymo.app/basket");
Deno.env.set("DEST_QR_URL", "https://api.easymo.app/qr");
Deno.env.set("DEST_DINE_URL", "https://api.easymo.app/dine");

const {
  extractKeyword,
  forwardToDestination,
  getDestinationUrl,
  normalizePayload,
  verifySignature,
} = await import("./index.ts");

function createMockPayload(
  messageType: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123456789",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "250788000000",
                phone_number_id: "123456789",
              },
              messages: [
                {
                  id: `wamid.${crypto.randomUUID()}`,
                  from: "250788000001",
                  type: messageType,
                  ...content,
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

async function createSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body),
  );
  const bytes = new Uint8Array(signature);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

Deno.test("wa-router: signature verification succeeds and fails when tampered", async () => {
  const body = JSON.stringify({ ping: "pong" });
  const signature = await createSignature(body, Deno.env.get("WA_APP_SECRET") ?? "");
  const request = new Request("http://localhost", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": signature },
  });
  const valid = await verifySignature(request, body);
  assertEquals(valid, true);

  const tampered = new Request("http://localhost", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": signature.replace(/.$/, "0") },
  });
  const invalid = await verifySignature(tampered, body);
  assertEquals(invalid, false);
});

Deno.test("wa-router: payload normalization extracts keywords", () => {
  const payload = createMockPayload("text", {
    text: { body: "Need insurance help" },
  });
  const normalized = normalizePayload(payload as any);
  assertEquals(normalized.length, 1);
  const message = normalized[0];
  assertEquals(message.type, "text");
  assertEquals(message.keyword, "insurance");
  assertEquals(message.metadata?.phoneNumberId, "123456789");
});

Deno.test("wa-router: extractKeyword normalizes plural forms", () => {
  assertEquals(extractKeyword("Show me baskets"), "basket");
  assertEquals(extractKeyword("random"), undefined);
});

Deno.test("wa-router: interactive payload preserves button metadata", () => {
  const payload = createMockPayload("interactive", {
    interactive: {
      type: "button_reply",
      button_reply: { id: "qr_start", title: "QR Code" },
    },
  });
  const normalized = normalizePayload(payload as any);
  assertEquals(normalized.length, 1);
  const message = normalized[0];
  assertEquals(message.keyword, "qr");
  assertEquals(message.interactive?.id, "qr_start");
});

Deno.test("wa-router: media payload captures caption keywords", () => {
  const payload = createMockPayload("image", {
    image: { id: "img_1", caption: "basket info" },
  });
  const normalized = normalizePayload(payload as any);
  const message = normalized[0];
  assertEquals(message.media?.type, "image");
  assertEquals(message.keyword, "basket");
});

Deno.test("wa-router: routing honours configured destinations", () => {
  assertEquals(getDestinationUrl("basket"), "https://api.easymo.app/basket");
  assertEquals(getDestinationUrl("insurance"), "https://api.easymo.app/insurance");
  assertEquals(getDestinationUrl("unknown"), undefined);
});

Deno.test("wa-router: forwardToDestination reports downstream errors", async () => {
  const payload = normalizePayload(createMockPayload("text", { text: { body: "basket" } }) as any)[0];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => Promise.reject(new Error("connection refused"));
    const result = await forwardToDestination("https://api.easymo.app/basket", payload, {} as any);
    assertEquals(result.status, 0);
    assertMatch(result.error ?? "", /connection refused/);
  } finally {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  }
});

Deno.test("wa-router: simulated webhook flow chooses correct destination", async () => {
  const payload = createMockPayload("text", {
    text: { body: "Hello, I want basket support" },
  });
  const normalized = normalizePayload(payload as any);
  const message = normalized[0];
  const destination = getDestinationUrl(message.keyword);
  assertEquals(destination, "https://api.easymo.app/basket");

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input, _init) => Promise.resolve(new Response(null, { status: 202 }));
    const result = await forwardToDestination(destination!, message, payload as any);
    assertEquals(result.status, 202);
    assertEquals(result.keyword, "basket");
  } finally {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  }
});
