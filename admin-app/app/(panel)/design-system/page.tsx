import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { UiShowcase } from "@/components/design-system/UiShowcase";
import { isUiKitEnabled } from "@/lib/runtime-config";

export const metadata: Metadata = {
  title: "Design system preview",
};

export default function DesignSystemPage() {
  if (!isUiKitEnabled()) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Design system preview"
        description="Feature-flagged preview of the unified easyMO UI tokens and headless component primitives."
      />
      <UiShowcase />
    </div>
  );
}
