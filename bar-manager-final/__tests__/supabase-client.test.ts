import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClientSpy = vi.fn();
const createServerClientSpy = vi.fn();
const cookiesMock = vi.fn();
const headersMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientSpy,
  createServerClient: createServerClientSpy,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  createBrowserClientSpy.mockReset();
  createServerClientSpy.mockReset();
  cookiesMock.mockReset();
  headersMock.mockReset();

  process.env = { ...originalEnv };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
   
  delete (globalThis as { window?: unknown }).window;
});

describe("createAdminClient", () => {
  it("throws when invoked on the client", async () => {
    (globalThis as { window?: unknown }).window = {};
    const { createAdminClient } = await import("@/src/v2/lib/supabase/client");

    await expect(createAdminClient()).rejects.toThrowError(
      "Admin client can only be used on the server",
    );
  });

  it("creates a server client with request context", async () => {
    const cookieGet = vi.fn((name: string) =>
      name === "sb" ? { value: "cookie-value" } : undefined,
    );
    const getAll = vi.fn(() => [{ name: "sb", value: "cookie-value" }]);
    cookiesMock.mockReturnValue({
      get: cookieGet,
      getAll,
      set: vi.fn(),
      delete: vi.fn(),
    });
    headersMock.mockReturnValue(new Headers({ "x-foo": "bar" }));

    const fakeClient = { auth: { getUser: vi.fn() } };
    createServerClientSpy.mockReturnValue(fakeClient);

    const { createAdminClient } = await import("@/src/v2/lib/supabase/client");
    const client = await createAdminClient();

    expect(client).toBe(fakeClient);
    expect(createServerClientSpy).toHaveBeenCalledTimes(1);

    const [url, key, options] = createServerClientSpy.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("service-role-key");
    expect(options?.cookies).toBeTruthy();
    expect(options?.headers).toBeTruthy();

    const cookieValue = options?.cookies?.get("sb");
    expect(cookieValue).toBe("cookie-value");
    expect(options?.cookies?.getAll?.()).toEqual([{ name: "sb", value: "cookie-value" }]);
    expect(options?.headers?.get("x-foo")).toBe("bar");
  });

  it("falls back to safe cookie adapter when request context is unavailable", async () => {
    cookiesMock.mockImplementation(() => {
      throw new Error("no request context");
    });
    headersMock.mockImplementation(() => {
      throw new Error("no headers");
    });

    const fakeClient = { auth: { getUser: vi.fn() } };
    createServerClientSpy.mockReturnValue(fakeClient);

    const { createAdminClient } = await import("@/src/v2/lib/supabase/client");
    const client = await createAdminClient();

    expect(client).toBe(fakeClient);
    const [, , options] = createServerClientSpy.mock.calls[0];
    expect(options?.cookies?.get("foo")).toBeUndefined();
    expect(options?.cookies?.getAll?.()).toEqual([]);
    expect(() => options?.cookies?.set("foo", "bar")).not.toThrow();
    expect(() => options?.cookies?.setAll?.([])).not.toThrow();
    expect(() => options?.cookies?.remove("foo")).not.toThrow();
    expect(options?.headers).toBeUndefined();
  });
});
