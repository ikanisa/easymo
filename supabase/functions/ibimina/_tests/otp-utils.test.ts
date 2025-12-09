/**
 * Unit tests for WhatsApp OTP helper utilities.
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertMatch,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

import {
  buildTemplatePayload,
  calculateTtlSeconds,
  generateOTP,
  handler as sendHandler,
  normalizePhoneNumber,
  validatePhoneNumber,
} from "../whatsapp-otp-send/index.ts";
import {
  base64UrlEncode,
  handler as verifyHandler,
  signJwt,
} from "../whatsapp-otp-verify/index.ts";

const decodeSegment = (segment: string) => {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
};

Deno.test("validatePhoneNumber accepts supported formats", () => {
  assert(validatePhoneNumber("0781234567"));
  assert(validatePhoneNumber("250781234567"));
  assert(validatePhoneNumber("+250781234567"));
});

Deno.test("validatePhoneNumber rejects invalid formats", () => {
  assertEquals(validatePhoneNumber("071234567"), false);
  assertEquals(validatePhoneNumber("12345"), false);
});

Deno.test("normalizePhoneNumber coerces to E.164", () => {
  assertEquals(normalizePhoneNumber("0781234567"), "+250781234567");
  assertEquals(normalizePhoneNumber("250781234567"), "+250781234567");
  assertEquals(normalizePhoneNumber("+250781234567"), "+250781234567");
});

Deno.test("generateOTP produces 6 digit codes", () => {
  const otp = generateOTP();
  assertEquals(otp.length, 6);
  assertMatch(otp, /^\d{6}$/);
});

Deno.test("buildTemplatePayload generates WhatsApp template body", () => {
  const payload = buildTemplatePayload("+250781234567", "123456", "otp_template", "en");

  assertEquals(payload.messaging_product, "whatsapp");
  assertEquals(payload.to, "250781234567");
  assertEquals(payload.template.name, "otp_template");
  assertEquals(payload.template.language.code, "en");
  assertEquals(payload.template.components.length, 1);
  const bodyComponent = payload.template.components[0];
  assertEquals(bodyComponent.type, "body");
  assertEquals(bodyComponent.parameters.length, 1);
  assertEquals(bodyComponent.parameters[0]?.text, "123456");
});

Deno.test("calculateTtlSeconds returns remaining lifetime in seconds", () => {
  const now = new Date();
  const expires = new Date(now.getTime() + 12_345);
  assertEquals(calculateTtlSeconds(expires, now), Math.ceil(12_345 / 1000));
});

Deno.test("calculateTtlSeconds clamps expired tokens to zero", () => {
  const now = new Date();
  const expired = new Date(now.getTime() - 1_000);
  assertEquals(calculateTtlSeconds(expired, now), 0);
});

Deno.test("base64UrlEncode removes padding and unsafe characters", () => {
  const encoded = base64UrlEncode(new Uint8Array([255, 240, 15]));
  assertMatch(encoded, /^[A-Za-z0-9_-]+$/);
  assert(!encoded.includes("="));
});

Deno.test("signJwt creates a token with expected claims", async () => {
  const token = await signJwt(
    {
      sub: "user-123",
      phone: "+250781234567",
      role: "member",
    },
    "super-secret",
    60
  );

  const [headerSeg, payloadSeg, signatureSeg] = token.split(".");
  assertEquals(typeof signatureSeg, "string");
  assert(signatureSeg.length > 0);

  const header = decodeSegment(headerSeg);
  const payload = decodeSegment(payloadSeg);

  assertEquals(header.alg, "HS256");
  assertEquals(header.typ, "JWT");
  assertEquals(payload.sub, "user-123");
  assertEquals(payload.phone, "+250781234567");
  assertEquals(payload.role, "member");
  assertExists(payload.iat);
  assertExists(payload.exp);
  assertEquals((payload.exp as number) - (payload.iat as number), 60);
});

Deno.test("send handler rejects missing phone", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  const response = await sendHandler(request);
  assertEquals(response.status, 400);
  const body = (await response.json()) as Record<string, unknown>;
  assertEquals(body.ok, false);
  assertExists(body.error);
});

Deno.test("verify handler rejects missing payload", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  const response = await verifyHandler(request);
  assertEquals(response.status, 400);
  const body = (await response.json()) as Record<string, unknown>;
  assertEquals(body.ok, false);
  assertExists(body.error);
});
