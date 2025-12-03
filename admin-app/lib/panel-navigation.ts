import type { Metadata } from "next";

export type PanelNavGroupId = "core";

export interface PanelNavItem {
  href: string;
  title: string;
  icon?: string;
  description?: string;
}

export interface PanelNavGroup {
  id: PanelNavGroupId;
  title: string;
  description?: string;
  collapsedByDefault?: boolean;
  links: PanelNavItem[];
}

export interface PanelNavigation {
  root: PanelNavItem;
  groups: PanelNavGroup[];
}

export interface PanelBreadcrumb {
  href?: string;
  label: string;
  current?: boolean;
}

const defaultDescription =
  "Operational console for the core easyMO workflows.";

const panelRoot: PanelNavItem = {
  href: "/insurance",
  title: "Insurance Agent",
  icon: "📊",
  description: "KPIs, service health, and quick access to operational tools.",
};

const coreNavigationGroup: PanelNavGroup = {
  id: "core",
  title: "Admin Utilities",
  description: "Primary workflows surfaced in the slim rail.",
  links: [
    { href: "/insurance", title: "Insurance" },
    { href: "/notifications", title: "Notifications" },
    { href: "/leads", title: "Leads" },
    { href: "/live-calls", title: "Live calls" },
    { href: "/marketplace", title: "Marketplace" },
    { href: "/momo-terminal/devices", title: "MoMo Devices" },
    { href: "/momo-terminal/transactions", title: "MoMo Transactions" },
    { href: "/momo-terminal/webhook-health", title: "Webhook Health" },
    { href: "/momo-terminal/security-audit", title: "Security Audit" },
    { href: "/sms-vendors", title: "SMS Vendors" },
    { href: "/client-portal", title: "Client Portal" },
    { href: "/support", title: "Support" },
    { href: "/settings", title: "Settings" },
  ],
};

const allGroups: PanelNavGroup[] = [coreNavigationGroup];

export const panelNavigation: PanelNavigation = {
  root: panelRoot,
  groups: allGroups,
};

const routeMetadata: Record<string, { title: string; description: string }> = {
  [panelRoot.href]: {
    title: panelRoot.title,
    description: panelRoot.description ?? defaultDescription,
  },
  "/insurance": {
    title: "Insurance",
    description: panelRoot.description ?? defaultDescription,
  },
  "/notifications": {
    title: "Notifications",
    description: "Operational notifications status and delivery metrics.",
  },
  "/leads": {
    title: "Leads",
    description: "Inspect marketing-sourced leads and handoff readiness.",
  },
  "/live-calls": {
    title: "Live Calls",
    description: "Observe call center volume, connect rates, and agent assignments.",
  },
  "/marketplace": {
    title: "Marketplace",
    description: "Review vendor onboarding health and catalog configuration progress.",
  },
  "/sms-vendors": {
    title: "SMS Vendors",
    description: "Register and manage vendors for SMS parsing service.",
  },
  "/sms-vendors/new": {
    title: "Register SMS Vendor",
    description: "Register a new vendor for SMS parsing service.",
  },
  "/client-portal": {
    title: "Client Portal",
    description: "Receive payments via mobile money QR codes.",
  },
  "/client-portal/transactions": {
    title: "Transactions",
    description: "View all payment transaction history.",
  },
  "/client-portal/payers": {
    title: "Payers",
    description: "View payer ledgers and payment history.",
  },
  "/client-portal/reports": {
    title: "Reports",
    description: "View periodic transaction reports and analytics.",
  },
  "/client-portal/profile": {
    title: "Profile",
    description: "Manage your account and mobile money settings.",
  },
  "/client-portal/momo-setup": {
    title: "Mobile Money Setup",
    description: "Configure your mobile money account for receiving payments.",
  },
  "/client-portal/settings": {
    title: "Settings",
    description: "Manage your account preferences.",
  },
  "/support": {
    title: "Support",
    description: "Chat with Sales, Marketing, and Support AI agents for assistance.",
  },
  "/settings": {
    title: "Settings",
    description: "Toggle demo mode, adjust throttles, and manage rollout controls.",
  },
};

const routeIndex = new Map<string, { title: string; groupId?: PanelNavGroupId }>();
routeIndex.set(panelRoot.href, { title: panelRoot.title });
for (const group of allGroups) {
  for (const link of group.links) {
    routeIndex.set(link.href, { title: link.title, groupId: group.id });
  }
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const value = pathname.split("?")[0].replace(/\/+$/, "");
  return value === "" ? "/" : value;
}

function titleize(segment: string): string {
  return segment
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findLongestMatch(pathname: string) {
  let match: { title: string; groupId?: PanelNavGroupId; href: string } | undefined;
  for (const [href, value] of routeIndex.entries()) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!match || href.length > match.href.length) {
        match = { ...value, href };
      }
    }
  }
  return match;
}

export function buildPanelBreadcrumbs(
  pathname: string,
  currentLabel?: string,
): PanelBreadcrumb[] {
  const normalized = normalizePath(pathname);
  const breadcrumbs: PanelBreadcrumb[] = [];

  breadcrumbs.push({
    href: panelRoot.href,
    label: panelRoot.title,
    current: normalized === panelRoot.href,
  });

  if (normalized === panelRoot.href) {
    if (currentLabel) {
      breadcrumbs[0].label = currentLabel;
    }
    return breadcrumbs;
  }

  const match = findLongestMatch(normalized);
  const isExactMatch = match && match.href === normalized;

  if (match?.groupId) {
    const group = allGroups.find((entry) => entry.id === match.groupId);
    if (group) {
      breadcrumbs[0].current = false;
      breadcrumbs.push({ label: group.title });
    }
  } else {
    breadcrumbs[0].current = false;
  }

  if (match) {
    breadcrumbs.push({
      href: match.href,
      label: match.title,
      current: isExactMatch && !currentLabel,
    });
  }

  if (!isExactMatch) {
    const startIndex = match ? match.href.split("/").filter(Boolean).length : 0;
    const segments = normalized.split("/").filter(Boolean);
    let accumulator = match ? match.href : "";

    for (let index = startIndex; index < segments.length; index += 1) {
      const segment = segments[index];
      accumulator = `${accumulator}/${segment}`.replace(/\/+/, "/");
      const isLast = index === segments.length - 1;
      breadcrumbs.push({
        href: accumulator,
        label: isLast && currentLabel ? currentLabel : titleize(segment),
        current: isLast,
      });
    }
  } else if (currentLabel) {
    breadcrumbs[breadcrumbs.length - 1] = {
      ...(breadcrumbs[breadcrumbs.length - 1] ?? {}),
      href: match.href,
      label: currentLabel,
      current: true,
    };
  }

  return breadcrumbs.map((crumb, index, array) => ({
    ...crumb,
    current: index === array.length - 1,
  }));
}

export function createPanelPageMetadata(pathname: string): Metadata {
  const normalized = normalizePath(pathname);
  const entry = routeMetadata[normalized];
  const title = entry?.title ?? panelRoot.title;
  const description = entry?.description ?? defaultDescription;

  return {
    title,
    description,
    alternates: {
      canonical: normalized,
    },
  } satisfies Metadata;
}

export function getRouteMetadata(pathname: string) {
  const normalized = normalizePath(pathname);
  return routeMetadata[normalized];
}
