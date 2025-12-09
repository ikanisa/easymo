import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUssdTemplateCache, loadUssdTemplate } from "@/lib/ussd/templates";
import { ussdConfig } from "@ibimina/config";

function createSupabaseStub(response: unknown, error: unknown = null) {
  const eqMock = vi.fn().mockReturnThis();
  const selectMock = vi.fn().mockReturnThis();
  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    eq: eqMock,
    maybeSingle: vi.fn().mockResolvedValue({ data: response, error }),
  });
  const schemaMock = vi.fn().mockReturnValue({
    from: fromMock,
  });

  return {
    schema: schemaMock,
    __mocks: { eqMock, selectMock, fromMock },
  } as unknown as Parameters<typeof loadUssdTemplate>[0];
}

describe("loadUssdTemplate", () => {
  beforeEach(() => {
    clearUssdTemplateCache();
  });

  it("returns Supabase payload when available", async () => {
    const payload = {
      operator_id: "mtn-rw",
      version: "2025-01-20",
      ttl_seconds: 600,
      payload: {
        ...ussdConfig.operators[0],
        templates: {
          ...ussdConfig.operators[0].templates,
        },
      },
    };

    const supabase = createSupabaseStub(payload);
    const result = await loadUssdTemplate(supabase, "mtn-rw");

    expect(result.operator.id).toBe("mtn-rw");
    expect(result.version).toBe("2025-01-20");
    expect(result.ttlSeconds).toBe(600);
  });

  it("falls back to config when Supabase has no data", async () => {
    const supabase = createSupabaseStub(null);
    const result = await loadUssdTemplate(supabase, "unknown-operator");

    expect(result.operator.id).toBe(ussdConfig.operators[0].id);
    expect(result.version).toContain(ussdConfig.version);
  });

  it("returns cached value on subsequent calls", async () => {
    const payload = {
      operator_id: "mtn-rw",
      version: "2025-01-20",
      ttl_seconds: 600,
      payload: {
        ...ussdConfig.operators[0],
      },
    };

    const supabase = createSupabaseStub(payload);
    await loadUssdTemplate(supabase, "mtn-rw");

    const cachedResult = await loadUssdTemplate(supabase, "mtn-rw");
    expect(cachedResult.version).toBe("2025-01-20");
  });
});
