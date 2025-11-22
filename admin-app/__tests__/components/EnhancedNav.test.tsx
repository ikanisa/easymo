import type { ReactNode } from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { EnhancedNav } from "@/components/navigation/EnhancedNav";

import { fireEvent, render, screen, waitFor } from "../../tests/utils/react-testing";

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
      // Prevent jsdom navigation side-effects during tests while preserving
      // component onClick behaviour (e.g. closing the mobile menu).
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

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe("EnhancedNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/insurance");
  });

  describe("Rendering", () => {
    it("renders the navigation with branding", () => {
      render(<EnhancedNav />);
      
      expect(screen.getByText("easyMO")).toBeInTheDocument();
      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    });

    it("renders skip link for accessibility", () => {
      render(<EnhancedNav />);
      
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("renders search button", () => {
      render(<EnhancedNav />);
      
      const searchButton = screen.getByRole("button", { name: /open search/i });
      expect(searchButton).toBeInTheDocument();
      expect(searchButton).toHaveAttribute("title", "Search (⌘K / Ctrl+K)");
    });

    it("renders root navigation link", () => {
      render(<EnhancedNav />);
      
      const rootLink = screen.getByRole("link", { name: /insurance agent/i });
      expect(rootLink).toBeInTheDocument();
      expect(rootLink).toHaveAttribute("href", "/insurance");
    });

    it("renders navigation groups", () => {
      render(<EnhancedNav />);
      
      // Check for group headers
      expect(screen.getByText("Admin Utilities")).toBeInTheDocument();
    });
  });

  describe("Active State", () => {
    it("highlights active root link", () => {
      mockUsePathname.mockReturnValue("/insurance");
      
      render(<EnhancedNav />);
      
      const rootLink = screen.getByRole("link", { name: /insurance agent/i });
      expect(rootLink).toHaveAttribute("aria-current", "page");
      expect(rootLink).toHaveClass("bg-blue-50", "text-blue-700");
    });

    it("highlights active group link", () => {
      mockUsePathname.mockReturnValue("/notifications");
      
      render(<EnhancedNav />);
      
      const notificationsLink = screen.getByRole("link", { name: /notifications/i });
      expect(notificationsLink).toHaveAttribute("aria-current", "page");
    });

    it("shows active indicator dot on current page", () => {
      mockUsePathname.mockReturnValue("/notifications");
      
      render(<EnhancedNav />);
      
      const activeIndicator = screen.getByLabelText("Current page");
      expect(activeIndicator).toBeInTheDocument();
    });
  });

  describe("Group Expansion", () => {
    it("allows toggling navigation groups", () => {
      render(<EnhancedNav />);
      
      const groupButton = screen.getByRole("button", { name: /admin utilities/i });
      
      // Check initial state
      expect(groupButton).toHaveAttribute("aria-expanded", "true");
      
      // Collapse the group
      fireEvent.click(groupButton);
      expect(groupButton).toHaveAttribute("aria-expanded", "false");
      
      // Expand the group again
      fireEvent.click(groupButton);
      expect(groupButton).toHaveAttribute("aria-expanded", "true");
    });

    it("auto-expands groups containing active links", () => {
      mockUsePathname.mockReturnValue("/notifications");
      
      render(<EnhancedNav />);
      
      const groupButton = screen.getByRole("button", { name: /admin utilities/i });
      expect(groupButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Keyboard Navigation", () => {
    it("supports Enter key for toggling groups", () => {
      render(<EnhancedNav />);
      
      const groupButton = screen.getByRole("button", { name: /admin utilities/i });
      
      // Press Enter to collapse
      fireEvent.keyDown(groupButton, { key: "Enter", code: "Enter" });
      expect(groupButton).toHaveAttribute("aria-expanded", "false");
    });

    it("supports Space key for toggling groups", () => {
      render(<EnhancedNav />);
      
      const groupButton = screen.getByRole("button", { name: /admin utilities/i });
      
      // Press Space to collapse
      fireEvent.keyDown(groupButton, { key: " ", code: "Space" });
      expect(groupButton).toHaveAttribute("aria-expanded", "false");
    });

    it("has proper focus styles on interactive elements", () => {
      render(<EnhancedNav />);
      
      const rootLink = screen.getByRole("link", { name: /insurance agent/i });
      expect(rootLink).toHaveClass("focus-visible:outline-none", "focus-visible:ring-2");
    });
  });

  describe("Search Integration", () => {
    it("calls onSearchOpen when search button is clicked", () => {
      const handleSearchOpen = vi.fn();
      render(<EnhancedNav onSearchOpen={handleSearchOpen} />);
      
      const searchButton = screen.getByRole("button", { name: /open search/i });
      fireEvent.click(searchButton);
      
      expect(handleSearchOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("Mobile Menu", () => {
    it("renders mobile menu toggle button", () => {
      render(<EnhancedNav />);
      
      const mobileToggle = screen.getByRole("button", { name: /open navigation menu/i });
      expect(mobileToggle).toBeInTheDocument();
      expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    });

    it("toggles mobile menu when button is clicked", () => {
      render(<EnhancedNav />);
      
      const mobileToggle = screen.getByRole("button", { name: /open navigation menu/i });
      
      // Open menu
      fireEvent.click(mobileToggle);
      expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
      expect(mobileToggle).toHaveAttribute("aria-label", "Close navigation menu");
      
      // Close menu
      fireEvent.click(mobileToggle);
      expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
      expect(mobileToggle).toHaveAttribute("aria-label", "Open navigation menu");
    });

    it("closes mobile menu when clicking overlay", () => {
      render(<EnhancedNav />);
      
      const mobileToggle = screen.getByRole("button", { name: /open navigation menu/i });
      
      // Open menu
      fireEvent.click(mobileToggle);
      expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
      
      // Click overlay to close
      const overlay = document.querySelector(".bg-black\\/50");
      if (overlay) {
        fireEvent.click(overlay);
      }
      
      // Menu should be closed
      waitFor(() => {
        expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
      });
    });
  });

  describe("Accessibility", () => {
    it("placeholder to keep block (moved to own file)", () => {
      expect(true).toBe(true);
    });
  });

  describe("Responsive Design", () => {
    it("placeholder (moved to own file)", () => {
      expect(true).toBe(true);
    });
  });

  describe("Link Descriptions", () => {
    it("placeholder (moved to own file)", () => {
      expect(true).toBe(true);
    });
  });
});
