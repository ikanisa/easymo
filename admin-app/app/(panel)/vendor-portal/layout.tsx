import "../../../styles/vendor-portal.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vendor Portal - Track Your Payments",
  description: "Mobile-first PWA for vendors to track SMS-parsed transactions",
};

interface VendorPortalLayoutProps {
  children: ReactNode;
}

export default function VendorPortalLayout({ children }: VendorPortalLayoutProps) {
  return <>{children}</>;
}
