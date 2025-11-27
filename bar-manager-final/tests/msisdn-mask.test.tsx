import { render, screen } from "@testing-library/react";
import { maskMsisdn } from "@va/shared";
import { describe, expect, it, vi } from "vitest";

import { UserDrawer } from "@/components/users/UserDrawer";
import type { User } from "@/lib/schemas";

const sampleUser: User = {
  id: "11111111-1111-4111-8111-111111111111",
  msisdn: "+250781234012",
  displayName: "Test User",
  locale: "en-RW",
  roles: [],
  status: "active",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  lastSeenAt: null,
};

describe("maskMsisdn", () => {
  it("masks a Rwandan MSISDN with grouped spacing", () => {
    expect(maskMsisdn("+250781234012")).toBe("+250 78* *** 012");
  });

  it("returns fallback when value is empty", () => {
    expect(maskMsisdn("")).toBe("—");
  });
});

describe("UserDrawer", () => {
  it("renders masked MSISDN in the drawer", () => {
    render(<UserDrawer user={sampleUser} onClose={vi.fn()} />);
    expect(screen.getByText("+250 78* *** 012")).toBeInTheDocument();
    expect(screen.queryByText("+250781234012")).not.toBeInTheDocument();
  });
});
