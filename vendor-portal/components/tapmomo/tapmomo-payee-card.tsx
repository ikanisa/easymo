"use client";

import { useState } from "react";
import { logError } from "@/lib/observability/logger";
import { GlassCard } from "@/components/ui/glass-card";
import { Trans } from "@/components/common/trans";

interface TapMoMoPayeeCardProps {
  merchants: Array<{
    id: string;
    merchant_code: string;
    display_name: string;
    network: string;
    is_active: boolean;
  }>;
  nfcEnabled: boolean;
}

export function TapMoMoPayeeCard({ merchants, nfcEnabled }: TapMoMoPayeeCardProps) {
  const [selectedMerchant, setSelectedMerchant] = useState(merchants[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMerchants = merchants.filter((m) => m.is_active);

  const handleActivate = async () => {
    if (!selectedMerchant) {
      setError("Please select a merchant");
      return;
    }

    if (!nfcEnabled) {
      setError("NFC is not enabled");
      return;
    }

    setError(null);

    try {
      const merchant = merchants.find((m) => m.id === selectedMerchant);
      if (!merchant) throw new Error("Merchant not found");

      // Get merchant key from backend
      const keyResponse = await fetch(`/api/tapmomo/merchant-key/${merchant.id}`);
      if (!keyResponse.ok) throw new Error("Failed to get merchant key");
      const { secret_key } = await keyResponse.json();

      // Activate NFC payee mode
      const result = await (window as any).TapMoMo.armPayee({
        network: merchant.network,
        merchantId: merchant.merchant_code,
        amount: amount ? parseInt(amount) : null,
        ref: reference || null,
        merchantKey: secret_key,
        ttlSeconds: 60,
      });

      setIsActive(true);
      setExpiresAt(result.expiresAt);

      // Auto-deactivate after 60 seconds
      setTimeout(() => {
        handleDeactivate();
      }, 60000);
    } catch (err: any) {
      setError(err.message || "Failed to activate payee mode");
    }
  };

  const handleDeactivate = async () => {
    try {
      await (window as any).TapMoMo.disarmPayee();
    } catch (err) {
      logError("Failed to deactivate:", err);
    } finally {
      setIsActive(false);
      setExpiresAt(null);
      setNonce(null);
    }
  };

  return (
    <GlassCard
      title={<Trans i18nKey="tapmomo.payee.title" fallback="Get Paid via NFC Tap" />}
      subtitle={
        <Trans
          i18nKey="tapmomo.payee.subtitle"
          fallback="Activate NFC to receive payment from payer's phone tap"
          className="text-xs text-neutral-3"
        />
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-sm text-rose-200">{error}</p>
          </div>
        )}

        {!isActive ? (
          <div className="space-y-4">
            {/* Merchant Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payee.merchant" fallback="Merchant" />
              </label>
              <select
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-0 focus:border-primary-500 focus:outline-none"
                disabled={activeMerchants.length === 0}
              >
                {activeMerchants.length === 0 && <option value="">No active merchants</option>}
                {activeMerchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.display_name} ({merchant.network})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payee.amount" fallback="Amount (RWF)" />
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2500"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-0 placeholder-neutral-3 focus:border-primary-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-3">
                <Trans
                  i18nKey="tapmomo.payee.amountHint"
                  fallback="Leave empty to let payer enter amount"
                />
              </p>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payee.reference" fallback="Reference (optional)" />
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-2025-001"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-0 placeholder-neutral-3 focus:border-primary-500 focus:outline-none"
              />
            </div>

            {/* Activate Button */}
            <button
              onClick={handleActivate}
              disabled={!nfcEnabled || activeMerchants.length === 0}
              className="w-full rounded-xl bg-primary-600 px-6 py-4 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trans i18nKey="tapmomo.payee.activate" fallback="Activate NFC for 60s" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Status */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
              <div className="mb-4">
                <div className="mx-auto h-24 w-24 rounded-full border-4 border-emerald-500/30 bg-emerald-500/20 flex items-center justify-center animate-pulse">
                  <svg
                    className="h-12 w-12 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-emerald-100 mb-2">
                <Trans i18nKey="tapmomo.payee.activeTitle" fallback="NFC Active" />
              </h3>
              <p className="text-sm text-emerald-200 mb-4">
                <Trans
                  i18nKey="tapmomo.payee.activeMessage"
                  fallback="Hold payer's device near your phone to receive payment"
                />
              </p>
              <div className="space-y-2 text-left">
                {amount && (
                  <p className="text-sm text-neutral-2">
                    <span className="text-neutral-3">Amount: </span>
                    <span className="font-medium text-neutral-0">
                      {parseInt(amount).toLocaleString()} RWF
                    </span>
                  </p>
                )}
                {reference && (
                  <p className="text-sm text-neutral-2">
                    <span className="text-neutral-3">Reference: </span>
                    <span className="font-medium text-neutral-0">{reference}</span>
                  </p>
                )}
                {expiresAt && (
                  <p className="text-sm text-neutral-3">
                    Expires: {new Date(expiresAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {/* Deactivate Button */}
            <button
              onClick={handleDeactivate}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-medium text-neutral-0 hover:bg-white/10 transition-colors"
            >
              <Trans i18nKey="tapmomo.payee.deactivate" fallback="Deactivate NFC" />
            </button>

            {/* Instructions */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payee.instructions" fallback="Instructions" />
              </h4>
              <ul className="space-y-1 text-xs text-neutral-2">
                <li>• Keep screen on and device unlocked</li>
                <li>• Payer should tap their device back-to-back</li>
                <li>• Transaction will appear in the list after payment</li>
                <li>• NFC will auto-deactivate after 60 seconds</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
