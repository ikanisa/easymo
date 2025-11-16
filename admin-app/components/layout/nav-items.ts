export {
  panelNavigation as PANEL_NAVIGATION,
  type PanelNavigation,
  type PanelNavGroup,
  type PanelNavItem,
  type PanelNavGroupId,
  type PanelBreadcrumb,
  buildPanelBreadcrumbs,
  createPanelPageMetadata,
  getRouteMetadata,
} from "@/lib/panel-navigation";
const coreFlows = [
  { href: "/dashboard", title: "Dashboard", icon: "📊" },
  { href: "/leads", title: "Leads", icon: "🎯" },
  { href: "/live-calls", title: "Live calls", icon: "📞" },
  { href: "/marketplace", title: "Marketplace", icon: "🏪" },
  { href: "/settings", title: "Settings", icon: "⚙️" },
];

export const NAV_SECTIONS = [
  { title: "Core", items: coreFlows },
];

export const NAV_ITEMS = coreFlows;
