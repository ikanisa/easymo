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
import { isFeatureFlagEnabled } from "@/lib/flags";

// Core navigation sections
const coreItems = [
  { href: "/dashboard", title: "Dashboard", icon: "📊" },
  { href: "/analytics", title: "Analytics", icon: "📈" },
];

// AI Agents section - Main focus of the platform
const aiAgentsItems = [
  { href: "/agents/overview", title: "Agent overview", icon: "🧭" },
  { href: "/agents/dashboard", title: "Agent dashboard", icon: "🤖" },
  { href: "/agents/driver-negotiation", title: "Driver agent", icon: "🚗" },
  { href: "/agents/pharmacy", title: "Pharmacy agent", icon: "💊" },
  { href: "/agents/shops", title: "Shops and services agent", icon: "🛍️" },
  { href: "/agents/quincaillerie", title: "Hardware agent", icon: "🔧" },
  { href: "/agents/property-rental", title: "Property agent", icon: "🏠" },
  { href: "/agents/schedule-trip", title: "Schedule agent", icon: "📅" },
  { href: "/agents/conversations", title: "Live conversations", icon: "💬" },
  { href: "/agents/instructions", title: "Playbooks", icon: "📘" },
  { href: "/agents/learning", title: "Agent learning", icon: "🧠" },
  { href: "/agents/performance", title: "Performance", icon: "📈" },
  { href: "/agents/settings", title: "Agent settings", icon: "⚙️" },
  { href: "/agents/tools", title: "Tools registry", icon: "🧰" },
];

// Operations section - Active sessions and monitoring
const operationsItems = [
  { href: "/tasks", title: "Tasks and workflows", icon: "✅" },
  { href: "/sessions", title: "Active sessions", icon: "🔄" },
  { href: "/negotiations", title: "Negotiations", icon: "🤝" },
  { href: "/vendor-responses", title: "Vendor responses", icon: "📨" },
  { href: "/video/jobs", title: "Video jobs", icon: "🎬" },
];

// Business modules
const businessItems = [
  { href: "/users", title: "Users", icon: "👥" },
  { href: "/trips", title: "Trips", icon: "🚕" },
  { href: "/insurance", title: "Insurance", icon: "🛡️" },
  { href: "/marketplace", title: "Marketplace", icon: "🏪" },
  { href: "/pharmacies", title: "Pharmacies", icon: "💊" },
  { href: "/quincailleries", title: "Quincailleries", icon: "🔧" },
  { href: "/shops", title: "Shops and services", icon: "🛍️" },
  { href: "/bars", title: "Bars and restaurants", icon: "🍽️" },
  { href: "/property-rentals", title: "Property rentals", icon: "🏠" },
  { href: "/qr", title: "MoMo QR and tokens", icon: "💳" },
];

// Marketing & Sales
const marketingItems = [
  { href: "/leads", title: "Leads", icon: "🎯" },
  { href: "/live-calls", title: "Live calls", icon: "📞" },
  { href: "/voice-analytics", title: "Voice analytics", icon: "🎙️" },
  { href: "/video/analytics", title: "Video analytics", icon: "🎬" },
];

// System & Settings
const systemItems = [
  { href: "/tools", title: "Integrations", icon: "🔌" },
  { href: "/logs", title: "System logs", icon: "📝" },
  { href: "/whatsapp-health", title: "WhatsApp health", icon: "💚" },
  { href: "/settings", title: "Settings", icon: "⚙️" },
  { href: "/settings/admin", title: "Admin controls", icon: "🛡️" },
];

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";
const adminHubV2Enabled = isFeatureFlagEnabled("adminHubV2");

const hubNavItems = [
  { href: "/hub", title: "Admin hub", icon: "✨" },
];

// Organize navigation with sections
export const NAV_SECTIONS = adminHubV2Enabled
  ? [{ title: "Hub", items: hubNavItems }]
  : [
      { title: "Overview", items: coreItems },
      { title: "AI agents", items: aiAgentsItems },
      { title: "Operations", items: operationsItems },
      { title: "Business", items: businessItems },
      { title: "Marketing", items: marketingItems },
      { title: "System", items: systemItems },
    ];

// Flat list for backward compatibility
const baseNavItems = [
  ...coreItems,
  ...aiAgentsItems,
  ...operationsItems,
  ...businessItems,
  ...marketingItems,
  ...systemItems,
];

const legacyNavItems = uiKitEnabled
  ? [...baseNavItems, { href: "/design-system", title: "Design system", icon: "🎨" }]
  : baseNavItems;

export const NAV_ITEMS = adminHubV2Enabled ? hubNavItems : legacyNavItems;
