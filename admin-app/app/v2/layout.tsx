import type { ReactNode } from "react";
import { DashboardLayout } from "@/src/v2/components/layout/DashboardLayout";

export default function V2Layout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
