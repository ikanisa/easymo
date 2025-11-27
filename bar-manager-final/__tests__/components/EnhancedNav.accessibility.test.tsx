import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnhancedNav } from "@/components/navigation/EnhancedNav";

import { render, screen } from "../../tests/utils/react-testing";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/insurance"),
}));

vi.mock("next/link", () => {
  const Link = ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string | { pathname?: string };
    children: ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => {
    const resolved = typeof href === "string" ? href : href?.pathname ?? "#";
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onClick?.(e);
    };
    return (
      <a href={resolved} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  };
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

describe("EnhancedNav accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/insurance");
  });

  it("has proper ARIA labels on navigation", () => {
    render(<EnhancedNav />);
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute("aria-label", "Primary navigation");
  });

  it("uses aria-current for active links", () => {
    mockUsePathname.mockReturnValue("/insurance");
    render(<EnhancedNav />);
    const activeLink = screen.getByRole("link", { name: /insurance agent/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("uses aria-expanded for collapsible groups", () => {
    render(<EnhancedNav />);
    const groupButton = screen.getByRole("button", { name: /admin utilities/i });
    expect(groupButton).toHaveAttribute("aria-expanded");
    expect(groupButton).toHaveAttribute("aria-controls");
  });

  it("uses aria-labelledby for group panels", () => {
    render(<EnhancedNav />);
    const groupButton = screen.getByRole("button", { name: /admin utilities/i });
    const panelId = groupButton.getAttribute("aria-controls");
    const panel = document.getElementById(panelId!);
    expect(panel).toHaveAttribute("aria-labelledby", groupButton.id);
  });

  it("hides decorative icons from screen readers", () => {
    render(<EnhancedNav />);
    const searchIcon = screen.getByRole("button", { name: /open search/i }).querySelector("svg");
    expect(searchIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("shows keyboard navigation hint in footer", () => {
    render(<EnhancedNav />);
    expect(screen.getByText(/press/i)).toBeInTheDocument();
    expect(screen.getByText("Tab")).toBeInTheDocument();
  });
});

