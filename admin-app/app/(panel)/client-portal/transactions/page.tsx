export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { TransactionsClient } from "./TransactionsClient";

export const metadata = createPanelPageMetadata("/client-portal/transactions");

export default function TransactionsPage() {
  return <TransactionsClient />;
}
