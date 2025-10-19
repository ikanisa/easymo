import axios from "axios";
import { settings } from "./config";
import { logger } from "./logger";

export type WalletChargeRequest = {
  customerRef: string;
  amount: number;
  currency: string;
};

export async function chargeWallet(request: WalletChargeRequest) {
  if (!settings.wallet.url) {
    logger.debug({ msg: "wallet.stub", request });
    return { status: "stubbed", reference: `stub-${request.customerRef}` };
  }

  const response = await axios.post(
    `${settings.wallet.url}/charges`,
    request,
    {
      headers: {
        Authorization: `Bearer ${settings.wallet.apiKey}`,
      },
    },
  );
  return response.data;
}
