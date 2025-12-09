import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const TOKEN = "313cf8ae6ca27abcd89b3e5e1db43a5b0cd43b0702d2b356f410f5c15f2fff5f";

type GlobalWithOverride = typeof globalThis & {
  __analyticsCacheRevalidateOverride?: (tag: string) => Promise<void>;
};

const globalWithOverride = globalThis as GlobalWithOverride;

const buildRequest = (body: unknown, headers: HeadersInit = {}) => {
  const request = new Request("http://localhost/api/cache/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return new NextRequest(request);
};

describe("cache revalidate webhook", () => {
  let invocations: string[] = [];

  beforeEach(async () => {
    process.env.ANALYTICS_CACHE_TOKEN = TOKEN;
    invocations = [];
    globalWithOverride.__analyticsCacheRevalidateOverride = async (tag: string) => {
      invocations.push(tag);
    };
  });

  afterEach(() => {
    delete process.env.ANALYTICS_CACHE_TOKEN;
    delete globalWithOverride.__analyticsCacheRevalidateOverride;
  });

  it("returns 200 when tags revalidate successfully", async () => {
    const { POST } = await import("@/app/api/cache/revalidate/route");

    const payload = {
      event: "payments_changed",
      saccoId: "11111111-1111-4111-8111-111111111111",
    };

    const request = buildRequest(payload, {
      authorization: `Bearer ${TOKEN}`,
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const json = (await response.json()) as {
      ok: boolean;
      tags: string[];
      results: Record<string, string>;
    };

    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.tags));
    assert.equal(
      Object.values(json.results).every((value) => value === "ok"),
      true
    );
    assert.equal(invocations.length, json.tags.length);
  });

  it("returns 207 when a tag revalidation throws", async () => {
    const { POST } = await import("@/app/api/cache/revalidate/route");

    globalWithOverride.__analyticsCacheRevalidateOverride = async (tag: string) => {
      invocations.push(tag);
      if (invocations.length === 1) {
        throw new Error("boom");
      }
    };

    const payload = {
      event: "recon_exceptions_changed",
      saccoId: null,
    };

    const request = buildRequest(payload, {
      authorization: `Bearer ${TOKEN}`,
    });

    const response = await POST(request);
    assert.equal(response.status, 207);

    const json = (await response.json()) as {
      ok: boolean;
      tags: string[];
      results: Record<string, string>;
    };

    assert.equal(json.ok, false);
    assert.ok(Object.values(json.results).includes("error"));
    assert.equal(invocations.length, json.tags.length);
  });
});
