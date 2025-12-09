import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

type EnvSnapshot = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

function restoreEnv(snapshot: EnvSnapshot) {
  if (typeof snapshot.NEXT_PUBLIC_SUPABASE_URL === "string") {
    process.env.NEXT_PUBLIC_SUPABASE_URL = snapshot.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }

  if (typeof snapshot.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string") {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = snapshot.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
}

describe("supabase config helpers", () => {
  let snapshot: EnvSnapshot;

  beforeEach(() => {
    snapshot = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it("returns config when env vars are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { requireSupabaseConfig, getSupabaseConfigStatus } = await import(
      `@/lib/supabase/config?ts=${Date.now()}`
    );

    const config = requireSupabaseConfig("test");
    assert.deepEqual(config, {
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });

    const status = getSupabaseConfigStatus();
    assert.equal(status.hasUrl, true);
    assert.equal(status.hasAnonKey, true);
  });

  it("throws a descriptive error when config is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { requireSupabaseConfig } = await import(`@/lib/supabase/config?ts=${Date.now()}`);

    const errorLogs: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errorLogs.push(args);
    };

    try {
      assert.throws(
        () => requireSupabaseConfig("unit-test"),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.name, "SupabaseConfigError");
          assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
          return true;
        }
      );
    } finally {
      console.error = originalError;
    }

    assert.equal(errorLogs.length, 1);
    const [firstEntry] = errorLogs;

    if (firstEntry.length === 1 && typeof firstEntry[0] === "string") {
      const parsed = JSON.parse(String(firstEntry[0]));
      assert.equal(parsed.event, "supabase.config.missing");
      assert.deepEqual(parsed.payload, {
        context: "unit-test",
        hasUrl: false,
        hasAnonKey: false,
      });
    } else {
      assert.deepEqual(firstEntry, [
        "supabase.config.missing",
        { context: "unit-test", hasUrl: false, hasAnonKey: false },
      ]);
    }
  });
});
