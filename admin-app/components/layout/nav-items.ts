import {
  adminRoutePaths,
  toAdminRoute,
  type AdminNavigableRoute,
  type NavigableAdminRouteKey,
} from "@/lib/routes";

export type NavGroup =
  | "Overview"
  | "Operations"
  | "Messaging"
  | "Platform"
  | "Baskets"
  | "AI";

export const NAV_GROUPS: NavGroup[] = [
  "Overview",
  "Operations",
  "Messaging",
  "Platform",
  "Baskets",
  "AI",
];

type NavItemDefinition<RouteKey extends NavigableAdminRouteKey = NavigableAdminRouteKey> = {
  label: string;
  route: RouteKey;
  description: string;
  group: NavGroup;
};

const NAV_ITEM_DEFINITIONS = [
  {
    label: "Dashboard",
    route: "panelDashboard",
    description: "KPIs and operational health",
    group: "Overview",
  },
  {
    label: "Users",
    route: "panelUsers",
    description: "Customer and staff profiles",
    group: "Overview",
  },
  {
    label: "Insurance",
    route: "panelInsurance",
    description: "HITL reviews and OCR data",
    group: "Overview",
  },
  {
    label: "Bars",
    route: "panelBars",
    description: "Vendor profile management and overrides",
    group: "Operations",
  },
  {
    label: "Menus & OCR",
    route: "panelMenus",
    description: "Menu drafts, publications, and OCR queue",
    group: "Operations",
  },
  {
    label: "Orders",
    route: "panelOrders",
    description: "Order status monitoring and safe overrides",
    group: "Operations",
  },
  {
    label: "Trips",
    route: "panelTrips",
    description: "Platform trips and statuses",
    group: "Operations",
  },
  {
    label: "Staff Numbers",
    route: "panelStaffNumbers",
    description: "Receiving numbers and verification",
    group: "Operations",
  },
  {
    label: "Stations",
    route: "panelStations",
    description: "Station directory and redemptions",
    group: "Operations",
  },
  {
    label: "Live Calls",
    route: "panelLiveCalls",
    description: "Realtime call monitoring and warm transfers",
    group: "Operations",
  },
  {
    label: "Leads",
    route: "panelLeads",
    description: "Lead search, tagging, and opt-in management",
    group: "Operations",
  },
  {
    label: "QR & Deep Links",
    route: "panelQr",
    description: "QR token batches and deep-link previews",
    group: "Operations",
  },
  {
    label: "Deep Links",
    route: "panelDeepLinks",
    description: "Issue Insurance, Basket, and QR entry links",
    group: "Operations",
  },
  {
    label: "Vouchers",
    route: "panelVouchers",
    description: "Issuance, preview, and lifecycle",
    group: "Messaging",
  },
  {
    label: "Campaigns",
    route: "panelCampaigns",
    description: "WhatsApp campaign orchestration",
    group: "Messaging",
  },
  {
    label: "Templates & Flows",
    route: "panelTemplates",
    description: "Template catalog and flow references",
    group: "Messaging",
  },
  {
    label: "WhatsApp Health",
    route: "panelWhatsAppHealth",
    description: "Delivery metrics and webhook logs",
    group: "Messaging",
  },
  {
    label: "Notifications",
    route: "panelNotifications",
    description: "Outbox status and resend controls",
    group: "Messaging",
  },
  {
    label: "Files",
    route: "panelFiles",
    description: "Storage browser for vouchers and docs",
    group: "Platform",
  },
  {
    label: "Marketplace",
    route: "panelMarketplace",
    description: "Intent pipeline, vendor ranking, and purchases",
    group: "Platform",
  },
  {
    label: "Marketplace Settings",
    route: "panelMarketplaceSettings",
    description: "Free contacts, window, subscription tokens",
    group: "Platform",
  },
  {
    label: "Agents",
    route: "panelAgents",
    description: "Configure AI personas, prompts, and deployments",
    group: "Platform",
  },
  {
    label: "Subscriptions",
    route: "panelSubscriptions",
    description: "Vendor entitlements and monthly subscription",
    group: "Platform",
  },
  {
    label: "Driver Subscriptions",
    route: "panelDriverSubscriptions",
    description: "Manage driver subscription payments",
    group: "Platform",
  },
  {
    label: "Wallet Top-up",
    route: "panelWalletTopUp",
    description: "Convert FX and credit vendor tokens",
    group: "Platform",
  },
  {
    label: "Payments (QR)",
    route: "adminPayments",
    description: "Generate QR codes for user payments",
    group: "Platform",
  },
  {
    label: "Payments List",
    route: "adminPaymentsList",
    description: "Recent payments and QR links",
    group: "Platform",
  },
  {
    label: "Assistant Memory",
    route: "adminMemory",
    description: "Upsert memory and touch sessions",
    group: "AI",
  },
  {
    label: "Suggestions",
    route: "adminSuggestions",
    description: "Search businesses by intent and region",
    group: "AI",
  },
  {
    label: "Settings",
    route: "panelSettings",
    description: "Quiet hours, throttles, templates",
    group: "Platform",
  },
  {
    label: "Logs",
    route: "panelLogs",
    description: "Unified audit and voucher events",
    group: "Platform",
  },
  {
    label: "Baskets (SACCOs)",
    route: "panelBaskets",
    description: "SACCO branches, Ibimina, contributions, and loans",
    group: "Baskets",
  },
  {
    label: "Chat Completions",
    route: "panelAiChatCompletions",
    description: "Exercise OpenAI prompts and review response metadata",
    group: "AI",
  },
] as const satisfies ReadonlyArray<NavItemDefinition>;

export type NavItem = (typeof NAV_ITEM_DEFINITIONS)[number] & {
  href: AdminNavigableRoute;
};

export const NAV_ITEMS: NavItem[] = NAV_ITEM_DEFINITIONS.map((definition) => ({
  ...definition,
  href: toAdminRoute(adminRoutePaths[definition.route]),
}));
