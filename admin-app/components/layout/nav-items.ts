// Core navigation sections
const coreItems = [
  { href: "/dashboard", title: "Dashboard", icon: "📊" },
  { href: "/analytics", title: "Analytics", icon: "📈" },
];

// AI Agents section - Main focus of the platform
const aiAgentsItems = [
  { href: "/agents/overview", title: "Agent Overview", icon: "🧭" },
  { href: "/agents/dashboard", title: "Agents Dashboard", icon: "🤖" },
  { href: "/agents/driver-negotiation", title: "Driver Agent", icon: "🚗" },
  { href: "/agents/pharmacy", title: "Pharmacy Agent", icon: "💊" },
  { href: "/agents/shops", title: "Shops Agent", icon: "🛍️" },
  { href: "/agents/quincaillerie", title: "Hardware Agent", icon: "🔧" },
  { href: "/agents/property-rental", title: "Property Agent", icon: "🏠" },
  { href: "/agents/schedule-trip", title: "Schedule Agent", icon: "📅" },
  { href: "/agents/conversations", title: "Live Conversations", icon: "💬" },
  { href: "/agents/instructions", title: "Playbooks", icon: "📘" },
  { href: "/agents/learning", title: "Agent Learning", icon: "🧠" },
  { href: "/agents/performance", title: "Performance", icon: "📈" },
  { href: "/agents/settings", title: "Agent Settings", icon: "⚙️" },
];

// Operations section - Active sessions and monitoring
const operationsItems = [
  { href: "/tasks", title: "Tasks & Workflows", icon: "✅" },
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
];

// System & Settings
const systemItems = [
  { href: "/tools", title: "Integrations", icon: "🔌" },
  { href: "/logs", title: "System Logs", icon: "📝" },
  { href: "/whatsapp-health", title: "WhatsApp Health", icon: "💚" },
  { href: "/settings", title: "Settings", icon: "⚙️" },
  { href: "/settings/admin", title: "Admin Controls", icon: "🛡️" },
];

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

// Organize navigation with sections
export const NAV_SECTIONS = [
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

export const NAV_ITEMS = uiKitEnabled
  ? [...baseNavItems, { href: "/design-system", title: "Design System", icon: "🎨" }]
  : baseNavItems;
