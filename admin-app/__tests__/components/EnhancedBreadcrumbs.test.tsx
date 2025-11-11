import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../tests/utils/react-testing";
import { EnhancedBreadcrumbs } from "@/components/navigation/EnhancedBreadcrumbs";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/insurance"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe("EnhancedBreadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders breadcrumb navigation", () => {
      render(<EnhancedBreadcrumbs />);
      
      const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
    });

    it("renders home icon when showHome is true", () => {
      render(<EnhancedBreadcrumbs showHome={true} />);
      
      const homeIcons = screen.getAllByRole("link")[0].querySelector("svg");
      expect(homeIcons).toBeInTheDocument();
    });

    it("does not render breadcrumbs for root path with showHome=false", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/insurance");
      
      const { container } = render(<EnhancedBreadcrumbs showHome={false} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("Breadcrumb Trail", () => {
    it("renders multiple breadcrumb items for nested paths", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications/settings");
      
      render(<EnhancedBreadcrumbs />);
      
      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThan(0);
    });

    it("highlights current page in breadcrumbs", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      // Current page should not be a link
      const currentPage = screen.getByLabelText(/current page/i);
      expect(currentPage).toBeInTheDocument();
      expect(currentPage).not.toHaveAttribute("href");
    });

    it("uses custom current label when provided", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs currentLabel="Custom Page Title" />);
      
      expect(screen.getByText("Custom Page Title")).toBeInTheDocument();
    });
  });

  describe("Separators", () => {
    it("renders chevron separators between breadcrumbs", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications/settings");
      
      render(<EnhancedBreadcrumbs />);
      
      // ChevronRight icons should be present
      const chevrons = document.querySelectorAll("svg");
      expect(chevrons.length).toBeGreaterThan(0);
    });

    it("does not render separator after last breadcrumb", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      const list = screen.getByRole("list");
      const items = list.querySelectorAll("li");
      const lastItem = items[items.length - 1];
      
      // Last item should not have a separator after it
      const chevrons = lastItem.querySelectorAll("svg.text-gray-400");
      expect(chevrons.length).toBe(0);
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA label on navigation", () => {
      render(<EnhancedBreadcrumbs />);
      
      const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
    });

    it("uses aria-current for current page", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      const currentItem = screen.getByLabelText(/current page/i).closest("li");
      expect(currentItem).toHaveAttribute("aria-current", "page");
    });

    it("provides accessible labels for navigation", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications/settings");
      
      render(<EnhancedBreadcrumbs />);
      
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAttribute("title");
      });
    });

    it("hides decorative icons from screen readers", () => {
      render(<EnhancedBreadcrumbs showHome={true} />);
      
      const homeIcon = screen.getAllByRole("link")[0].querySelector("svg");
      expect(homeIcon).toHaveAttribute("aria-hidden", "true");
    });

    it("uses role=list on breadcrumb container", () => {
      render(<EnhancedBreadcrumbs />);
      
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("supports keyboard focus on breadcrumb links", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications/settings");
      
      render(<EnhancedBreadcrumbs />);
      
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveClass("focus-visible:outline-none", "focus-visible:ring-2");
      });
    });
  });

  describe("Text Truncation", () => {
    it("applies max-width to prevent overflow", () => {
      render(<EnhancedBreadcrumbs />);
      
      const breadcrumbTexts = document.querySelectorAll(".truncate");
      expect(breadcrumbTexts.length).toBeGreaterThan(0);
      
      breadcrumbTexts.forEach((text) => {
        expect(text).toHaveClass("max-w-[200px]");
      });
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(<EnhancedBreadcrumbs className="custom-class" />);
      
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("custom-class");
    });

    it("highlights current page with bold text", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      const currentPage = screen.getByLabelText(/current page/i);
      expect(currentPage).toHaveClass("font-semibold", "text-gray-900");
    });

    it("applies hover styles to breadcrumb links", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications/settings");
      
      render(<EnhancedBreadcrumbs />);
      
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveClass("hover:text-gray-900", "hover:bg-gray-100");
      });
    });
  });

  describe("Integration with Panel Navigation", () => {
    it("builds breadcrumbs from panel navigation structure", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      // Should include root breadcrumb
      expect(screen.getByText("Insurance Agent")).toBeInTheDocument();
    });

    it("includes group title in breadcrumb trail", () => {
      const { usePathname } = require("next/navigation");
      usePathname.mockReturnValue("/notifications");
      
      render(<EnhancedBreadcrumbs />);
      
      // Should show Admin Utilities group
      expect(screen.getByText("Admin Utilities")).toBeInTheDocument();
    });
  });
});
