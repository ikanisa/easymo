export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";

import { SuppliersClient } from "./SuppliersClient";

export const metadata = createPanelPageMetadata("/suppliers");

export default async function SuppliersPage() {
  const queryClient = createQueryClient();
  const dehydrated = dehydrate(queryClient);
  return (
    <HydrationBoundary state={dehydrated}>
      <SuppliersClient />
    </HydrationBoundary>
  );
}
