import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { WalletTopupClient } from "./WalletTopupClient";

export const metadata = createPanelPageMetadata("/wallet/topup");

export default function WalletTopupPage() {
  return <WalletTopupClient />;
}
