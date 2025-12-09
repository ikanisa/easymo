import type { PanelIconKey } from "@/components/admin/panel/types";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: PanelIconKey;
};

export type AdminNavGroup = {
  title: string;
  links: ReadonlyArray<AdminNavLink>;
};

// Flat list for backward compatibility
export const ADMIN_NAV_LINKS: ReadonlyArray<AdminNavLink> = [
  { href: "/admin/overview", label: "Overview", icon: "overview" },
  { href: "/admin/saccos", label: "SACCOs", icon: "saccos" },
  { href: "/admin/groups", label: "Groups", icon: "groups" },
  { href: "/admin/members", label: "Members", icon: "members" },
  { href: "/admin/loans", label: "Loans pipeline", icon: "loans" },
  { href: "/admin/staff", label: "Staff", icon: "staff" },
  { href: "/admin/approvals", label: "Approvals & Invites", icon: "approvals" },
  { href: "/admin/reconciliation", label: "Deposits & Reconciliation", icon: "reconciliation" },
  { href: "/admin/payments", label: "Payments & Settlement", icon: "payments" },
  { href: "/admin/ocr", label: "OCR Review", icon: "ocr" },
  { href: "/admin/notifications", label: "Notifications & Comms", icon: "notifications" },
  { href: "/admin/reports", label: "Reports & Exports", icon: "reports" },
  { href: "/admin/settings", label: "Settings & Policies", icon: "settings" },
  { href: "/admin/audit", label: "Audit & Logs", icon: "audit" },
  { href: "/admin/feature-flags", label: "Feature Flags & Experiments", icon: "feature-flags" },
];

// Grouped navigation for better UX
export const ADMIN_NAV_GROUPS: ReadonlyArray<AdminNavGroup> = [
  {
    title: "Overview",
    links: [{ href: "/admin/overview", label: "Dashboard", icon: "overview" }],
  },
  {
    title: "Core Data",
    links: [
      { href: "/admin/saccos", label: "SACCOs", icon: "saccos" },
      { href: "/admin/groups", label: "Groups", icon: "groups" },
      { href: "/admin/members", label: "Members", icon: "members" },
      { href: "/admin/staff", label: "Staff", icon: "staff" },
    ],
  },
  {
    title: "Operations",
    links: [
      { href: "/admin/approvals", label: "Approvals & Invites", icon: "approvals" },
      { href: "/admin/reconciliation", label: "Deposits & Reconciliation", icon: "reconciliation" },
      { href: "/admin/payments", label: "Payments & Settlement", icon: "payments" },
      { href: "/admin/ocr", label: "OCR Review", icon: "ocr" },
      { href: "/admin/loans", label: "Loans pipeline", icon: "loans" },
    ],
  },
  {
    title: "Communication & Reports",
    links: [
      { href: "/admin/notifications", label: "Notifications & Comms", icon: "notifications" },
      { href: "/admin/reports", label: "Reports & Exports", icon: "reports" },
    ],
  },
  {
    title: "System",
    links: [
      { href: "/admin/settings", label: "Settings & Policies", icon: "settings" },
      { href: "/admin/audit", label: "Audit & Logs", icon: "audit" },
      { href: "/admin/feature-flags", label: "Feature Flags", icon: "feature-flags" },
    ],
  },
];
