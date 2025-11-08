const baseNavItems = [
  { href: "/dashboard", title: "Dashboard" },
  { href: "/users", title: "Users" },
  { href: "/insurance", title: "Insurance" },
  { href: "/orders", title: "Orders" },
  { href: "/trips", title: "Trips" },
  { href: "/campaigns", title: "Campaigns" },
  { href: "/marketplace", title: "Marketplace" },
  { href: "/leads", title: "Leads" },
  { href: "/live-calls", title: "Live calls" },
  { href: "/voice-analytics", title: "Voice analytics" },
  { href: "/settings", title: "Settings" },
];

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

export const NAV_ITEMS = uiKitEnabled
  ? [...baseNavItems, { href: "/design-system", title: "Design system" }]
  : baseNavItems;
