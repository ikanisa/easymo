import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../tests/utils/react-testing";
import { EnhancedNav } from "@/components/navigation/EnhancedNav";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/insurance"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe("EnhancedNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(searchButton).toHaveAttribute("title", "Search (⌘K)");
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
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/insurance");
      
      render(<EnhancedNav />);
      
      const rootLink = screen.getByRole("link", { name: /insurance agent/i });
      expect(rootLink).toHaveAttribute("aria-current", "page");
      expect(rootLink).toHaveClass("bg-blue-50", "text-blue-700");
    });

    it("highlights active group link", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedNav />);
      
      const notificationsLink = screen.getByRole("link", { name: /notifications/i });
      expect(notificationsLink).toHaveAttribute("aria-current", "page");
    });

    it("shows active indicator dot on current page", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
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
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
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

  describe("Accessibility", () => {
    it("has proper ARIA labels on navigation", () => {
      render(<EnhancedNav />);
      
      const nav = screen.getByRole("navigation", { name: /primary navigation/i });
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("aria-label", "Primary navigation");
    });

    it("uses aria-current for active links", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/insurance");
      
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
      
      // Icons should have aria-hidden="true"
      const searchIcon = screen.getByRole("button", { name: /open search/i }).querySelector("svg");
      expect(searchIcon).toHaveAttribute("aria-hidden", "true");
    });

    it("shows keyboard navigation hint in footer", () => {
      render(<EnhancedNav />);
      
      expect(screen.getByText(/press/i)).toBeInTheDocument();
      expect(screen.getByText("Tab")).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
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

  describe("Link Descriptions", () => {
    it("shows link descriptions as tooltips", () => {
      render(<EnhancedNav />);
      
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("title");
      });
    });
  });
});
