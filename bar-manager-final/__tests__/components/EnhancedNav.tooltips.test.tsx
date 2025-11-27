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

describe("EnhancedNav tooltips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/insurance");
  });

  it("shows link descriptions as tooltips on grouped links", () => {
    render(<EnhancedNav />);
    const allLinks = screen.getAllByRole("link");
    const groupLinks = allLinks.filter((el) => el.closest('ul[role="group"]'));
    expect(groupLinks.length).toBeGreaterThan(0);
    groupLinks.forEach((link) => {
      expect(link).toHaveAttribute("title");
    });
  });
});
