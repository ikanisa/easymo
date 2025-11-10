import { isFeatureFlagEnabled } from "@/lib/flags";

// Core navigation sections
const coreItems = [
  { href: "/dashboard", title: "Dashboard", icon: "📊" },
];

// AI Agents section - Main focus of the platform
const aiAgentsItems = [
  { href: "/agents/dashboard", title: "Agents Dashboard", icon: "🤖" },
  { href: "/agents/driver-negotiation", title: "Driver Agent", icon: "🚗" },
  { href: "/agents/pharmacy", title: "Pharmacy Agent", icon: "💊" },
  { href: "/agents/shops", title: "Shops Agent", icon: "🛍️" },
  { href: "/agents/quincaillerie", title: "Hardware Agent", icon: "🔧" },
  { href: "/agents/property-rental", title: "Property Agent", icon: "🏠" },
  { href: "/agents/schedule-trip", title: "Schedule Agent", icon: "📅" },
  { href: "/agents/conversations", title: "Live Conversations", icon: "💬" },
  { href: "/agents/learning", title: "Agent Learning", icon: "🧠" },
  { href: "/agents/performance", title: "Performance", icon: "📈" },
  { href: "/agents/settings", title: "Agent Settings", icon: "⚙️" },
  { href: "/agents/tools", title: "Tools Registry", icon: "🧰" },
];

// Operations section - Active sessions and monitoring
const operationsItems = [
  { href: "/sessions", title: "Active Sessions", icon: "🔄" },
  { href: "/negotiations", title: "Negotiations", icon: "🤝" },
  { href: "/vendor-responses", title: "Vendor Responses", icon: "📨" },
];

// Business modules
const businessItems = [
  { href: "/users", title: "Users", icon: "👥" },
  { href: "/trips", title: "Trips", icon: "🚕" },
  { href: "/insurance", title: "Insurance", icon: "🛡️" },
  { href: "/marketplace", title: "Marketplace", icon: "🏪" },
];

// Marketing & Sales
const marketingItems = [
  { href: "/leads", title: "Leads", icon: "🎯" },
  { href: "/live-calls", title: "Live Calls", icon: "📞" },
  { href: "/voice-analytics", title: "Voice Analytics", icon: "🎙️" },
  { href: "/video/analytics", title: "Video Analytics", icon: "🎬" },
];

// System & Settings
const systemItems = [
  { href: "/logs", title: "System Logs", icon: "📝" },
  { href: "/whatsapp-health", title: "WhatsApp Health", icon: "💚" },
  { href: "/settings", title: "Settings", icon: "⚙️" },
];

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";
const adminHubV2Enabled = isFeatureFlagEnabled("adminHubV2");

const hubNavItems = [
  { href: "/hub", title: "Admin Hub", icon: "✨" },
];

// Organize navigation with sections
export const NAV_SECTIONS = adminHubV2Enabled
  ? [{ title: "Hub", items: hubNavItems }]
  : [
      { title: "Overview", items: coreItems },
      { title: "AI Agents", items: aiAgentsItems },
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
  ? [...baseNavItems, { href: "/design-system", title: "Design System", icon: "🎨" }]
  : baseNavItems;

export const NAV_ITEMS = adminHubV2Enabled ? hubNavItems : legacyNavItems;
