import type { ReactNode } from "react";
import { describe, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../tests/utils/react-testing";
import { EnhancedNav } from "@/components/navigation/EnhancedNav";

// Use the same next/link mock behavior as the main spec file to avoid jsdom navigation.
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

// Mock Next.js navigation usage as in the main spec file
const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/insurance"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe("EnhancedNav (link close behavior)", () => {
  it("closes mobile menu when clicking a navigation link", () => {
    render(<EnhancedNav />);

    const mobileToggle = screen.getByRole("button", { name: /open navigation menu/i });

    // Open menu
    fireEvent.click(mobileToggle);

    // Click a navigation link
    const link = screen.getByRole("link", { name: /notifications/i });
    fireEvent.click(link);

    // Menu should be closed
    waitFor(() => {
      expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    });
  });
});

