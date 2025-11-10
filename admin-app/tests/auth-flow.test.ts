import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn(() => {
  const error = new Error("NEXT_REDIRECT");
  // @ts-expect-error attach code for assertions
  error.code = "NEXT_REDIRECT";
  throw error;
});

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    redirect: redirectSpy,
  };
});

describe("panel layout authentication", () => {
  beforeEach(() => {
    redirectSpy.mockClear();
  });

  it("redirects to /login when session is missing", async () => {
    const { default: PanelLayout } = await import("@/app/(panel)/layout");

    await expect(PanelLayout({ children: <div>Protected route</div> })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith("/login");
  });

  it("renders children when seeded session cookie exists", async () => {
    const { createSessionCookie } = await import("@/lib/server/session");
    const { cookies } = await import("next/headers");
    const sessionCookie = createSessionCookie({
      actorId: "00000000-0000-0000-0000-000000000001",
      label: "Seeded Operator",
      ttlMs: 60_000,
    });
    const store = cookies();
    store.set(sessionCookie.name, sessionCookie.value);

    const { default: PanelLayout } = await import("@/app/(panel)/layout");
    const result = await PanelLayout({ children: <div id="session-check">Protected route</div> });
    expect(result).toBeTruthy();
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});
