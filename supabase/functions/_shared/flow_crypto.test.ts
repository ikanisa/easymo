import {
  base64Decode,
  base64Encode,
  decryptFlowEnvelope,
  encryptFlowPayload,
  flipIv,
  resetCachedFlowPrivateKey,
} from "./flow_crypto.ts";

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  const normalize = (value: unknown): unknown => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    if (Array.isArray(value)) {
      return value.map(normalize);
    }
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(
          value,
          (_, v) => v instanceof Uint8Array ? Array.from(v) : v,
        );
      } catch (_err) {
        return value;
      }
    }
    return value;
  };

  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);
  if (normalizedActual === normalizedExpected) return;
  if (Object.is(normalizedActual, normalizedExpected)) return;
  if (
    normalizedActual &&
    normalizedExpected &&
    typeof normalizedActual === "object" &&
    typeof normalizedExpected === "object" &&
    JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected)
  ) {
    return;
  }
  throw new Error(
    message ??
      `Assertion failed: ${normalizedActual} !== ${normalizedExpected}`,
  );
}

function chunk64(base64: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += 64) {
    chunks.push(base64.slice(i, i + 64));
  }
  return chunks.join("\n");
}

type MockEnvelope<T> = {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
  payload: T;
};

async function buildEncryptedEnvelope<T>(
  publicKey: CryptoKey,
  payload: T,
): Promise<MockEnvelope<T>> {
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawAesKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", aesKey),
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedFlow = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
      },
      aesKey,
      plaintext,
    ),
  );
  const encryptedKey = new Uint8Array(
    await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKey),
  );
  return {
    encrypted_flow_data: base64Encode(encryptedFlow),
    encrypted_aes_key: base64Encode(encryptedKey),
    initial_vector: base64Encode(iv),
    payload,
  };
}

Deno.test("flowCrypto decrypts envelope and re-encrypts response", async () => {
  resetCachedFlowPrivateKey();
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", privateKey),
  );
  const base64 = chunk64(base64Encode(pkcs8));
  const pem =
    `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
  Deno.env.set("FLOW_PRIVATE_KEY", pem);
  resetCachedFlowPrivateKey();

  const envelope = await buildEncryptedEnvelope(publicKey, {
    flow_id: "flow.cust.bar_browser.v1",
    action: "INIT",
    data: {
      wa_id: "+250700000001",
      fields: { action_id: "a_show_results" },
    },
  });

  const { request, context } = await decryptFlowEnvelope<
    typeof envelope.payload
  >(
    envelope,
  );

  assertEquals(request.flow_id, "flow.cust.bar_browser.v1");
  assertEquals(request.action, "INIT");
  assert(request.data);
  assertEquals(
    (request.data as { fields?: { action_id?: string } }).fields?.action_id,
    "a_show_results",
  );

  const responsePayload = { data: { acknowledged: true } };
  const encryptedResponse = await encryptFlowPayload(responsePayload, context);
  const decryptedResponse = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: flipIv(context.iv), tagLength: 128 },
      context.aesKey,
      base64Decode(encryptedResponse),
    ),
  );
  const decodedJson = new TextDecoder().decode(decryptedResponse);
  assertEquals(JSON.parse(decodedJson), responsePayload);

  Deno.env.delete("FLOW_PRIVATE_KEY");
  resetCachedFlowPrivateKey();
});

Deno.test("flowCrypto base64 helpers round-trip", () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = base64Encode(bytes);
  const decoded = base64Decode(encoded);
  assertEquals(decoded.length, bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    assertEquals(decoded[i], bytes[i]);
  }
});

Deno.test("flipIv produces deterministic xor with 0xff", () => {
  const iv = new Uint8Array([0x00, 0x12, 0xae, 0xff]);
  const flipped = flipIv(iv);
  assertEquals(Array.from(flipped), [0xff, 0xed, 0x51, 0x00]);
  const doubleFlipped = flipIv(flipped);
  for (let i = 0; i < iv.length; i += 1) {
    assertEquals(doubleFlipped[i], iv[i]);
  }
});
