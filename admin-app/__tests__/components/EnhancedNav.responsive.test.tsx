import { ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "../../tests/utils/react-testing";
import { EnhancedNav } from "@/components/navigation/EnhancedNav";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/insurance"),
}));

vi.mock("next/link", () => {
  const Link = ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  );
  return { __esModule: true, default: Link };
});

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe("EnhancedNav responsive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/insurance");
  });

  it("applies mobile-first classes", () => {
    render(<EnhancedNav />);
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(nav).toHaveClass("-translate-x-full", "md:translate-x-0");
  });

  it("hides mobile toggle on desktop", () => {
    render(<EnhancedNav />);
    const mobileToggle = screen.getByRole("button", { name: /open navigation menu/i });
    expect(mobileToggle).toHaveClass("md:hidden");
  });
});

