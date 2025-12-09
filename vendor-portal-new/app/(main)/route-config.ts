import {
  LayoutDashboard,
  Workflow,
  Inbox,
  LineChart,
  Settings2,
  BarChartBig,
  UsersRound,
  ShieldCheck,
  Building2,
  Scan,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RouteGroupDefinition = {
  id: string;
  titleKey: string;
  fallbackTitle: string;
  descriptionKey?: string;
  fallbackDescription?: string;
  primaryRouteId?: string;
};

export type RouteDefinition = {
  id: string;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  descriptionKey?: string;
  fallbackDescription?: string;
  icon?: LucideIcon;
  groupId: string;
  inNavigation?: boolean;
  parentId?: string;
};

export type RouteBreadcrumbDefinition = {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  href?: string;
};

export const ROUTE_GROUPS: RouteGroupDefinition[] = [
  {
    id: "overview",
    titleKey: "nav.group.overview",
    fallbackTitle: "Overview",
    descriptionKey: "nav.group.overview.description",
    fallbackDescription: "High-level health & KPIs",
    primaryRouteId: "dashboard",
  },
  {
    id: "operations",
    titleKey: "nav.group.operations",
    fallbackTitle: "Operations",
    descriptionKey: "nav.group.operations.description",
    fallbackDescription: "Daily execution & reconciliations",
    primaryRouteId: "ikimina",
  },
  {
    id: "insights",
    titleKey: "nav.group.insights",
    fallbackTitle: "Insights",
    descriptionKey: "nav.group.insights.description",
    fallbackDescription: "Analytics & reporting",
    primaryRouteId: "analytics",
  },
  {
    id: "governance",
    titleKey: "nav.group.governance",
    fallbackTitle: "Governance",
    descriptionKey: "nav.group.governance.description",
    fallbackDescription: "Administration & access",
    primaryRouteId: "admin",
  },
];

export const ROUTES: RouteDefinition[] = [
  {
    id: "dashboard",
    path: "/dashboard",
    titleKey: "nav.dashboard",
    fallbackTitle: "Dashboard",
    descriptionKey: "nav.dashboard.description",
    fallbackDescription: "Unified SACCO status",
    icon: LayoutDashboard,
    groupId: "overview",
    inNavigation: true,
  },
  {
    id: "analytics",
    path: "/analytics",
    titleKey: "nav.analytics",
    fallbackTitle: "Analytics",
    descriptionKey: "nav.analytics.description",
    fallbackDescription: "Trend monitoring",
    icon: LineChart,
    groupId: "insights",
    inNavigation: true,
  },
  {
    id: "reports",
    path: "/reports",
    titleKey: "nav.reports",
    fallbackTitle: "Reports",
    descriptionKey: "nav.reports.description",
    fallbackDescription: "Statements & exports",
    icon: BarChartBig,
    groupId: "insights",
    inNavigation: true,
  },
  {
    id: "ikimina",
    path: "/ikimina",
    titleKey: "nav.ikimina",
    fallbackTitle: "Ikimina",
    descriptionKey: "nav.ikimina.description",
    fallbackDescription: "Group management",
    icon: Workflow,
    groupId: "operations",
    inNavigation: true,
  },
  {
    id: "recon",
    path: "/recon",
    titleKey: "nav.recon",
    fallbackTitle: "Reconciliation",
    descriptionKey: "nav.recon.description",
    fallbackDescription: "Match statements",
    icon: Inbox,
    groupId: "operations",
    inNavigation: true,
  },
  {
    id: "ops",
    path: "/ops",
    titleKey: "nav.ops",
    fallbackTitle: "Operations Centre",
    descriptionKey: "nav.ops.description",
    fallbackDescription: "Alerts & health",
    icon: Settings2,
    groupId: "operations",
    inNavigation: true,
  },
  {
    id: "admin",
    path: "/admin",
    titleKey: "nav.admin",
    fallbackTitle: "Admin",
    descriptionKey: "nav.admin.description",
    fallbackDescription: "System controls",
    icon: UsersRound,
    groupId: "governance",
    inNavigation: true,
  },
  {
    id: "profile",
    path: "/profile",
    titleKey: "nav.profile",
    fallbackTitle: "Account security",
    descriptionKey: "nav.profile.description",
    fallbackDescription: "Sign-in & MFA",
    icon: ShieldCheck,
    groupId: "governance",
    inNavigation: true,
  },
  {
    id: "countries",
    path: "/countries",
    titleKey: "nav.countries",
    fallbackTitle: "Countries",
    descriptionKey: "nav.countries.description",
    fallbackDescription: "Jurisdiction settings",
    icon: Building2,
    groupId: "governance",
    inNavigation: false,
    parentId: "admin",
  },
  {
    id: "partners",
    path: "/partners",
    titleKey: "nav.partners",
    fallbackTitle: "Partners",
    descriptionKey: "nav.partners.description",
    fallbackDescription: "Integrations",
    icon: Building2,
    groupId: "operations",
    inNavigation: false,
    parentId: "ops",
  },
  {
    id: "scan-login",
    path: "/scan-login",
    titleKey: "nav.scanLogin",
    fallbackTitle: "Scan login",
    descriptionKey: "nav.scanLogin.description",
    fallbackDescription: "QR sign-in",
    icon: Scan,
    groupId: "operations",
    inNavigation: false,
    parentId: "ops",
  },
];

const ROUTE_MAP = new Map(ROUTES.map((route) => [route.id, route]));
const GROUP_MAP = new Map(ROUTE_GROUPS.map((group) => [group.id, group]));

export function getRouteByPath(pathname: string): RouteDefinition | undefined {
  const sorted = [...ROUTES].sort((a, b) => b.path.length - a.path.length);
  return sorted.find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`));
}

export function getNavigationGroups(): Array<{
  group: RouteGroupDefinition;
  routes: RouteDefinition[];
}> {
  return ROUTE_GROUPS.map((group) => ({
    group,
    routes: ROUTES.filter((route) => route.groupId === group.id && route.inNavigation),
  })).filter((entry) => entry.routes.length > 0);
}

export function getBreadcrumbChain(pathname: string): RouteBreadcrumbDefinition[] {
  const route = getRouteByPath(pathname);
  if (!route) {
    return [];
  }

  const breadcrumbs: RouteBreadcrumbDefinition[] = [];
  const visited = new Set<string>();

  let current: RouteDefinition | undefined = route;
  while (current && !visited.has(current.id)) {
    breadcrumbs.push({
      id: current.id,
      labelKey: current.titleKey,
      fallbackLabel: current.fallbackTitle,
      href: current.path,
    });
    visited.add(current.id);
    current = current.parentId ? ROUTE_MAP.get(current.parentId) : undefined;
  }

  breadcrumbs.reverse();

  const group = GROUP_MAP.get(route.groupId);
  if (group) {
    const primaryRoute = group.primaryRouteId ? ROUTE_MAP.get(group.primaryRouteId) : undefined;
    breadcrumbs.unshift({
      id: group.id,
      labelKey: group.titleKey,
      fallbackLabel: group.fallbackTitle,
      href: primaryRoute?.path,
    });
  }

  return breadcrumbs;
}

export function getGroupDescription(groupId: string) {
  const group = GROUP_MAP.get(groupId);
  if (!group) return undefined;
  return {
    id: group.id,
    labelKey: group.descriptionKey ?? group.titleKey,
    fallbackLabel: group.fallbackDescription ?? group.fallbackTitle,
  };
}

export type NavigationGroup = ReturnType<typeof getNavigationGroups>[number];
