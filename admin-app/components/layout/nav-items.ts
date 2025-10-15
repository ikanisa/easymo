export type NavGroup =
  | "Overview"
  | "Operations"
  | "Messaging"
  | "Platform"
  | "Baskets";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  group: NavGroup;
};

export const NAV_GROUPS: NavGroup[] = [
  "Overview",
  "Operations",
  "Messaging",
  "Platform",
  "Baskets",
];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "KPIs and operational health",
    group: "Overview",
  },
  {
    label: "Users",
    href: "/users",
    description: "Customer and staff profiles",
    group: "Overview",
  },
  {
    label: "Insurance",
    href: "/insurance",
    description: "HITL reviews and OCR data",
    group: "Overview",
  },
  {
    label: "Bars",
    href: "/bars",
    description: "Vendor profile management and overrides",
    group: "Operations",
  },
  {
    label: "Menus & OCR",
    href: "/menus",
    description: "Menu drafts, publications, and OCR queue",
    group: "Operations",
  },
  {
    label: "Orders",
    href: "/orders",
    description: "Order status monitoring and safe overrides",
    group: "Operations",
  },
  {
    label: "Staff Numbers",
    href: "/staff-numbers",
    description: "Receiving numbers and verification",
    group: "Operations",
  },
  {
    label: "Stations",
    href: "/stations",
    description: "Station directory and redemptions",
    group: "Operations",
  },
  {
    label: "QR & Deep Links",
    href: "/qr",
    description: "QR token batches and deep-link previews",
    group: "Operations",
  },
  {
    label: "Deep Links",
    href: "/deep-links",
    description: "Issue Insurance, Basket, and QR entry links",
    group: "Operations",
  },
  {
    label: "Vouchers",
    href: "/vouchers",
    description: "Issuance, preview, and lifecycle",
    group: "Messaging",
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    description: "WhatsApp campaign orchestration",
    group: "Messaging",
  },
  {
    label: "Templates & Flows",
    href: "/templates",
    description: "Template catalog and flow references",
    group: "Messaging",
  },
  {
    label: "WhatsApp Health",
    href: "/whatsapp-health",
    description: "Delivery metrics and webhook logs",
    group: "Messaging",
  },
  {
    label: "Notifications",
    href: "/notifications",
    description: "Outbox status and resend controls",
    group: "Messaging",
  },
  {
    label: "Files",
    href: "/files",
    description: "Storage browser for vouchers and docs",
    group: "Platform",
  },
  {
    label: "Settings",
    href: "/settings",
    description: "Quiet hours, throttles, templates",
    group: "Platform",
  },
  {
    label: "Logs",
    href: "/logs",
    description: "Unified audit and voucher events",
    group: "Platform",
  },
  {
    label: "Baskets (SACCOs)",
    href: "/baskets",
    description: "SACCO branches, Ibimina, contributions, and loans",
    group: "Baskets",
  },
];
