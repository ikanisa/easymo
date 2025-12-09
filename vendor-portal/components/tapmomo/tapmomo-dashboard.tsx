"use client";

import { useState, useEffect } from "react";
import { Trans } from "@/components/common/trans";
import { TapMoMoPayeeCard } from "./tapmomo-payee-card";
import { TapMoMoPayerCard } from "./tapmomo-payer-card";
import { TapMoMoTransactionsList } from "./tapmomo-transactions-list";

interface TapMoMoDashboardProps {
  saccoId?: string;
  merchants: Array<{
    id: string;
    merchant_code: string;
    display_name: string;
    network: string;
    is_active: boolean;
  }>;
}

export function TapMoMoDashboard({ saccoId, merchants }: TapMoMoDashboardProps) {
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"payee" | "payer" | "transactions">("payee");

  useEffect(() => {
    // Check NFC availability on Android
    if (typeof window !== "undefined" && "TapMoMo" in window) {
      (window as any).TapMoMo.checkNfcAvailable()
        .then((result: any) => {
          setNfcAvailable(result.available);
          setNfcEnabled(result.enabled);
        })
        .catch(() => {
          setNfcAvailable(false);
        });
    } else {
      // Web version - NFC not available
      setNfcAvailable(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* NFC Status Banner */}
      {nfcAvailable === false && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">
            <Trans
              i18nKey="tapmomo.nfcNotAvailable"
              fallback="NFC is not available on this device. TapMoMo requires NFC-enabled Android device."
            />
          </p>
        </div>
      )}

      {nfcAvailable === true && nfcEnabled === false && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">
            <Trans
              i18nKey="tapmomo.nfcDisabled"
              fallback="NFC is disabled. Please enable NFC in device settings to use TapMoMo."
            />
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        <TabButton active={activeTab === "payee"} onClick={() => setActiveTab("payee")}>
          <Trans i18nKey="tapmomo.tabs.getPaid" fallback="Get Paid" />
        </TabButton>
        <TabButton active={activeTab === "payer"} onClick={() => setActiveTab("payer")}>
          <Trans i18nKey="tapmomo.tabs.pay" fallback="Pay" />
        </TabButton>
        <TabButton
          active={activeTab === "transactions"}
          onClick={() => setActiveTab("transactions")}
        >
          <Trans i18nKey="tapmomo.tabs.transactions" fallback="Transactions" />
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === "payee" && (
        <TapMoMoPayeeCard
          merchants={merchants}
          nfcEnabled={nfcEnabled === true}
          saccoId={saccoId}
        />
      )}

      {activeTab === "payer" && (
        <TapMoMoPayerCard nfcEnabled={nfcEnabled === true} saccoId={saccoId} />
      )}

      {activeTab === "transactions" && <TapMoMoTransactionsList saccoId={saccoId} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-primary-500 text-primary-400"
          : "text-neutral-2 hover:text-neutral-0"
      }`}
    >
      {children}
    </button>
  );
}
