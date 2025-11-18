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

// Expose a compatibility NAV_SECTIONS shape for tests and legacy UI.
// Tests toggle globalThis.__EASYMO_FEATURE_FLAGS__?.adminHubV2 to verify two vocabularies:
//  - Legacy sections (Overview, AI agents, Operations, Business, Marketing, System)
//  - Hub preview (single section "Hub" with one item "Admin hub")

declare global {
  // eslint-disable-next-line no-var
  var __EASYMO_FEATURE_FLAGS__:
    | {
        adminHubV2?: boolean;
      }
    | undefined;
}

const legacySections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", title: "Dashboard" },
      { href: "/analytics", title: "Analytics" },
    ],
  },
  {
    title: "AI agents",
    items: [
      { href: "/agents/overview", title: "Agent overview" },
      { href: "/agents/dashboard", title: "Agent dashboard" },
      { href: "/agents/driver", title: "Driver agent" },
      { href: "/agents/pharmacy", title: "Pharmacy agent" },
      { href: "/agents/shops", title: "Shops and services agent" },
      { href: "/agents/hardware", title: "Hardware agent" },
      { href: "/agents/property", title: "Property agent" },
      { href: "/agents/schedule", title: "Schedule agent" },
      { href: "/agents/live-conversations", title: "Live conversations" },
      { href: "/agents/playbooks", title: "Playbooks" },
      { href: "/agents/learning", title: "Agent learning" },
      { href: "/agents/performance", title: "Performance" },
      { href: "/agents/settings", title: "Agent settings" },
      { href: "/agents/tools", title: "Tools registry" },
      { href: "/agents/tasks", title: "Tasks and workflows" },
      { href: "/agents/sessions", title: "Active sessions" },
      { href: "/agents/negotiations", title: "Negotiations" },
      { href: "/agents/vendor-responses", title: "Vendor responses" },
      { href: "/agents/video-jobs", title: "Video jobs" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/users", title: "Users" },
      { href: "/trips", title: "Trips" },
      { href: "/insurance", title: "Insurance" },
      { href: "/marketplace", title: "Marketplace" },
      { href: "/pharmacies", title: "Pharmacies" },
      { href: "/quincailleries", title: "Quincailleries" },
      { href: "/shops", title: "Shops and services" },
      { href: "/bars-restaurants", title: "Bars and restaurants" },
      { href: "/property-rentals", title: "Property rentals" },
      { href: "/momo", title: "MoMo QR and tokens" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/leads", title: "Leads" },
      { href: "/live-calls", title: "Live calls" },
      { href: "/voice-analytics", title: "Voice analytics" },
      { href: "/video-analytics", title: "Video analytics" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/integrations", title: "Integrations" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/system/logs", title: "System logs" },
      { href: "/whatsapp/health", title: "WhatsApp health" },
      { href: "/whatsapp/menu", title: "WhatsApp menu" },
      { href: "/settings", title: "Settings" },
      { href: "/admin-controls", title: "Admin controls" },
    ],
  },
] as const;

const hubSections = [
  { title: "Hub", items: [{ href: "/hub", title: "Admin hub" }] },
] as const;

export const NAV_SECTIONS = (globalThis.__EASYMO_FEATURE_FLAGS__?.adminHubV2
  ? hubSections
  : legacySections) as Array<{ title: string; items: Array<{ href: string; title: string }> }>;

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
