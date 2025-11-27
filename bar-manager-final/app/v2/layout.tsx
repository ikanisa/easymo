"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { DashboardLayout } from "@/src/v2/components/layout/DashboardLayout";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </ToastProvider>
  );
}
