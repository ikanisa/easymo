"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, PhoneCall } from "lucide-react";
import { track } from "@/src/lib/analytics";

interface UssdParams {
  merchant: string;
  reference: string;
  telUri: string | null;
  provider?: string | null;
  account_name?: string | null;
}

interface UssdInstructionsProps {
  groupId: string | null;
}

export function UssdInstructions({ groupId }: UssdInstructionsProps) {
  const [params, setParams] = useState<UssdParams | null>(null);
  const [isLoading, startFetch] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!groupId) {
      queueMicrotask(() => {
        if (!cancelled) {
          setParams(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    startFetch(async () => {
      const response = await fetch(`/api/member/pay/ussd-params?group_id=${groupId}`);
      if (!response.ok) {
        console.error("Failed to load USSD parameters");
        return;
      }
      const data = (await response.json()) as UssdParams;
      if (!cancelled) {
        setParams(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const copy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
      void track({
        event: "staff_ussd_copy",
        properties: { field, hasTelUri: Boolean(params?.telUri), groupId },
      });
    } catch (error) {
      console.error("Failed to copy USSD value", error);
      void track({
        event: "staff_ussd_copy_failed",
        properties: { field, groupId },
      });
    }
  };

  useEffect(() => {
    if (params && !params.telUri) {
      void track({
        event: "staff_ussd_manual_required",
        properties: { groupId },
      });
    }
  }, [params, groupId]);

  if (!groupId) {
    return <p className="text-sm text-white/70">Select a group to view USSD instructions.</p>;
  }

  if (isLoading && !params) {
    return <p className="text-sm text-white/70">Preparing USSD instructions…</p>;
  }

  if (!params) {
    return <p className="text-sm text-red-200">Unable to load USSD instructions.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/20 bg-white/10 p-5 text-neutral-0">
        <h3 className="text-lg font-semibold">Payment steps</h3>
        <ol className="mt-3 space-y-2 text-sm text-white/80">
          <li>1. Dial the code below on your phone.</li>
          <li>2. Enter the merchant number.</li>
          <li>3. Provide the reference exactly as shown.</li>
        </ol>
      </div>
      <div className="space-y-1 rounded-3xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white/80">
        <p>
          <span className="font-semibold text-neutral-0">Provider:</span> {params.provider ?? "MTN"}
        </p>
        {params.account_name ? (
          <p>
            <span className="font-semibold text-neutral-0">Account name:</span>{" "}
            {params.account_name}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        <CopyField
          label="Merchant"
          value={params.merchant}
          copy={copy}
          copied={copied === params.merchant}
        />
        <CopyField
          label="Reference"
          value={params.reference}
          copy={copy}
          copied={copied === params.reference}
        />
        {params.telUri ? (
          <a
            href={params.telUri}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/80 px-4 py-3 text-base font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-emerald-500"
            onClick={() =>
              track({
                event: "staff_ussd_dial_attempt",
                properties: { groupId, provider: params.provider ?? "MTN" },
              })
            }
          >
            <PhoneCall className="h-5 w-5" aria-hidden /> Launch USSD
          </a>
        ) : null}
      </div>
    </div>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  copy: (value: string, field: string) => Promise<void>;
  copied: boolean;
}

function CopyField({ label, value, copy, copied }: CopyFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/15 bg-white/8 px-4 py-3 text-neutral-0">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
      <button
        onClick={() => copy(value, label.toLowerCase())}
        className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-white/25"
      >
        <Copy className="h-4 w-4" aria-hidden />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
