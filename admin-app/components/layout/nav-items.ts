export {
  buildPanelBreadcrumbs,
  createPanelPageMetadata,
  getRouteMetadata,
  panelNavigation as PANEL_NAVIGATION,
  type PanelBreadcrumb,
  type PanelNavGroup,
  type PanelNavGroupId,
  type PanelNavigation,
  type PanelNavItem,
} from "@/lib/panel-navigation";

// Expose a compatibility NAV_SECTIONS shape for tests and legacy UI.
// Tests toggle globalThis.__EASYMO_FEATURE_FLAGS__?.adminHubV2 to verify two vocabularies:
//  - Legacy sections (Overview, AI agents, Operations, Business, Marketing, System)
//  - Hub preview (single section "Hub" with one item "Admin hub")

declare global {
   
  var __EASYMO_FEATURE_FLAGS__:
    | {
        adminHubV2?: boolean;
      }
    | undefined;
}

/**
 * EasyMO Rwanda-only admin navigation
 * Supported services: Mobility, Insurance, Buy & Sell, Profile, Wallet
 */
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
      { href: "/agents/schedule", title: "Schedule agent" },
      { href: "/agents/live-conversations", title: "Live conversations" },
      { href: "/agents/playbooks", title: "Playbooks" },
      { href: "/agents/learning", title: "Agent learning" },
      { href: "/agents/performance", title: "Performance" },
      { href: "/agents/settings", title: "Agent settings" },
      { href: "/agent-admin/agents", title: "Provider routing" },
      { href: "/agents/tools", title: "Tools registry" },
      { href: "/agents/tasks", title: "Tasks and workflows" },
      { href: "/agents/sessions", title: "Active sessions" },
      { href: "/agents/negotiations", title: "Negotiations" },
      { href: "/agents/vendor-responses", title: "Vendor responses" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/users", title: "Users" },
      { href: "/trips", title: "Trips" },
      { href: "/insurance", title: "Insurance" },
      { href: "/marketplace", title: "Marketplace" },
      { href: "/sms-vendors", title: "SMS Vendors" },
      { href: "/client-portal", title: "Client Portal" },
      { href: "/momo", title: "MoMo QR and tokens" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/leads", title: "Leads" },
      { href: "/live-calls", title: "Live calls" },
      { href: "/voice-analytics", title: "Voice analytics" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/system/logs", title: "System logs" },
      { href: "/whatsapp/health", title: "WhatsApp health" },
      { href: "/whatsapp/menu", title: "WhatsApp menu" },
      { href: "/support", title: "Support" },
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
