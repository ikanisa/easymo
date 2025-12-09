"use client";

import { useState, useEffect } from "react";
import { logError } from "@/lib/observability/logger";
import { GlassCard } from "@/components/ui/glass-card";
import { Trans } from "@/components/common/trans";

interface TapMoMoPayerCardProps {
  nfcEnabled: boolean;
  saccoId?: string;
}

interface PaymentPayload {
  network: string;
  merchantId: string;
  amount: number | null;
  currency: string;
  ref: string | null;
  nonce: string;
}

export function TapMoMoPayerCard({ nfcEnabled, saccoId }: TapMoMoPayerCardProps) {
  const [isReading, setIsReading] = useState(false);
  const [payload, setPayload] = useState<PaymentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    // Load available SIM subscriptions
    if (typeof window !== "undefined" && "TapMoMo" in window) {
      (window as any).TapMoMo.getActiveSubscriptions()
        .then((result: any) => {
          setSubscriptions(result.subscriptions || []);
          if (result.subscriptions?.length > 0) {
            setSelectedSub(result.subscriptions[0].subscriptionId);
          }
        })
        .catch(console.error);
    }
  }, []);

  const handleStartReading = async () => {
    if (!nfcEnabled) {
      setError("NFC is not enabled");
      return;
    }

    setError(null);
    setPayload(null);
    setIsReading(true);

    try {
      // Start NFC reader
      await (window as any).TapMoMo.startReader();

      // Listen for payload received event
      (window as any).TapMoMo.addListener("payloadReceived", (event: any) => {
        setIsReading(false);
        setPayload({
          network: event.network,
          merchantId: event.merchantId,
          amount: event.amount,
          currency: event.currency || "RWF",
          ref: event.ref,
          nonce: event.nonce,
        });
      });

      // Listen for errors
      (window as any).TapMoMo.addListener("readerError", (event: any) => {
        setIsReading(false);
        setError(event.error || "Failed to read payment details");
      });
    } catch (err: any) {
      setIsReading(false);
      setError(err.message || "Failed to start NFC reader");
    }
  };

  const handleStopReading = async () => {
    try {
      await (window as any).TapMoMo.stopReader();
    } catch (err) {
      logError("Failed to stop reader:", err);
    } finally {
      setIsReading(false);
    }
  };

  const handlePay = async () => {
    if (!payload) return;

    const finalAmount = payload.amount || parseInt(customAmount);
    if (!finalAmount) {
      setError("Please enter an amount");
      return;
    }

    setError(null);

    try {
      // Launch USSD
      await (window as any).TapMoMo.launchUssd({
        network: payload.network,
        merchantId: payload.merchantId,
        amount: finalAmount,
        subscriptionId: selectedSub,
      });

      // Record transaction
      await fetch("/api/tapmomo/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_code: payload.merchantId,
          nonce: payload.nonce,
          amount: finalAmount,
          currency: payload.currency,
          ref: payload.ref,
          network: payload.network,
          sacco_id: saccoId,
        }),
      });

      // Reset
      setPayload(null);
      setCustomAmount("");
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
    }
  };

  const handleCancel = () => {
    setPayload(null);
    setCustomAmount("");
    setError(null);
  };

  return (
    <GlassCard
      title={<Trans i18nKey="tapmomo.payer.title" fallback="Pay via NFC Tap" />}
      subtitle={
        <Trans
          i18nKey="tapmomo.payer.subtitle"
          fallback="Tap your phone to payee's device to read payment details"
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

        {!isReading && !payload && (
          <div className="space-y-4">
            <button
              onClick={handleStartReading}
              disabled={!nfcEnabled}
              className="w-full rounded-xl bg-primary-600 px-6 py-4 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trans i18nKey="tapmomo.payer.startReading" fallback="Tap to Read Payment" />
            </button>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payer.instructions" fallback="How to pay" />
              </h4>
              <ul className="space-y-1 text-xs text-neutral-2">
                <li>• Tap the button above to activate NFC reader</li>
                <li>• Hold your phone back-to-back with payee's device</li>
                <li>• Payment details will appear automatically</li>
                <li>• Confirm and complete payment via USSD</li>
              </ul>
            </div>
          </div>
        )}

        {isReading && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-6 text-center">
            <div className="mb-4">
              <div className="mx-auto h-24 w-24 rounded-full border-4 border-sky-500/30 bg-sky-500/20 flex items-center justify-center animate-pulse">
                <svg
                  className="h-12 w-12 text-sky-400"
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
            <h3 className="text-lg font-semibold text-sky-100 mb-2">
              <Trans i18nKey="tapmomo.payer.reading" fallback="Reading..." />
            </h3>
            <p className="text-sm text-sky-200 mb-6">
              <Trans
                i18nKey="tapmomo.payer.readingMessage"
                fallback="Hold your phone near the payee's device"
              />
            </p>
            <button
              onClick={handleStopReading}
              className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-neutral-0 hover:bg-white/10 transition-colors"
            >
              <Trans i18nKey="tapmomo.payer.cancel" fallback="Cancel" />
            </button>
          </div>
        )}

        {payload && (
          <div className="space-y-4">
            {/* Payment Details */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <h4 className="text-sm font-medium text-neutral-1">
                <Trans i18nKey="tapmomo.payer.paymentDetails" fallback="Payment Details" />
              </h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-neutral-3">Network</p>
                  <p className="font-medium text-neutral-0">{payload.network}</p>
                </div>
                <div>
                  <p className="text-neutral-3">Merchant</p>
                  <p className="font-medium text-neutral-0">{payload.merchantId}</p>
                </div>
                {payload.ref && (
                  <div className="col-span-2">
                    <p className="text-neutral-3">Reference</p>
                    <p className="font-medium text-neutral-0">{payload.ref}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-neutral-1 mb-2">
                <Trans i18nKey="tapmomo.payer.amount" fallback="Amount (RWF)" />
              </label>
              {payload.amount ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-2xl font-semibold text-neutral-0">
                    {payload.amount.toLocaleString()} {payload.currency}
                  </p>
                </div>
              ) : (
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-0 placeholder-neutral-3 focus:border-primary-500 focus:outline-none"
                />
              )}
            </div>

            {/* SIM Selection */}
            {subscriptions.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-neutral-1 mb-2">
                  <Trans i18nKey="tapmomo.payer.sim" fallback="SIM Card" />
                </label>
                <select
                  value={selectedSub || ""}
                  onChange={(e) => setSelectedSub(parseInt(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-neutral-0 focus:border-primary-500 focus:outline-none"
                >
                  {subscriptions.map((sub) => (
                    <option key={sub.subscriptionId} value={sub.subscriptionId}>
                      {sub.displayName || sub.carrierName} - {sub.number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCancel}
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-neutral-0 hover:bg-white/10 transition-colors"
              >
                <Trans i18nKey="tapmomo.payer.cancel" fallback="Cancel" />
              </button>
              <button
                onClick={handlePay}
                disabled={!payload.amount && !customAmount}
                className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trans i18nKey="tapmomo.payer.pay" fallback="Pay Now" />
              </button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
