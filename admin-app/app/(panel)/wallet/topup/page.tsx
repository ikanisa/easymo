import { WalletTopupClient } from "./WalletTopupClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/wallet/topup");

export default function WalletTopupPage() {
  return <WalletTopupClient />;
}
