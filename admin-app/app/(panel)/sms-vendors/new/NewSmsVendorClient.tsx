"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { type SmsVendor, useCreateSmsVendorMutation } from "@/lib/queries/sms-vendors";

export function NewSmsVendorClient() {
  const router = useRouter();
  const [vendorName, setVendorName] = useState("");
  const [payeeMomoNumber, setPayeeMomoNumber] = useState("");
  const [whatsappE164, setWhatsappE164] = useState("");
  const [notes, setNotes] = useState("");
  const [createdVendor, setCreatedVendor] = useState<SmsVendor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateSmsVendorMutation({
    onSuccess: (vendor) => {
      setCreatedVendor(vendor);
    },
    onError: (err) => {
      setError(err.message || "Failed to create vendor");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vendorName.trim()) {
      setError("Vendor name is required");
      return;
    }
    if (!payeeMomoNumber.trim()) {
      setError("Payee MoMo number is required");
      return;
    }
    if (!whatsappE164.trim()) {
      setError("WhatsApp number is required");
      return;
    }

    await createMutation.mutateAsync({
      vendorName: vendorName.trim(),
      payeeMomoNumber: payeeMomoNumber.trim(),
      whatsappE164: whatsappE164.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const webhookUrl = typeof window !== "undefined" 
    ? `${window.location.origin.replace(/admin\./, "")}/functions/v1/momo-sms-webhook`
    : "https://[supabase-url]/functions/v1/momo-sms-webhook";

  if (createdVendor) {
    return (
      <div className="admin-page">
        <PageHeader
          title="Vendor Registered Successfully"
          description="Save the credentials below for MomoTerminal configuration."
        />

        <SectionCard title="Vendor Details" description="Registration complete.">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  Vendor Name
                </label>
                <p className="text-[var(--aurora-text-primary)]">{createdVendor.vendorName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  Status
                </label>
                <p className="text-[var(--aurora-text-primary)] capitalize">{createdVendor.subscriptionStatus}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  Payee MoMo Number
                </label>
                <p className="text-[var(--aurora-text-primary)]">{createdVendor.payeeMomoNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  WhatsApp Number
                </label>
                <p className="text-[var(--aurora-text-primary)]">{createdVendor.whatsappE164}</p>
              </div>
            </div>

            <div className="border-t border-[var(--aurora-border)] pt-6">
              <h3 className="text-lg font-semibold text-[var(--aurora-text-primary)] mb-4">
                MomoTerminal Configuration
              </h3>
              <p className="text-sm text-[var(--aurora-text-secondary)] mb-4">
                Use the following credentials to configure MomoTerminal for this vendor.
              </p>
              
              <div className="space-y-4 bg-[var(--aurora-surface)] rounded-lg p-4 border border-[var(--aurora-border)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                    API Key
                  </label>
                  <code className="block text-sm bg-[var(--aurora-surface-elevated)] p-3 rounded border border-[var(--aurora-border)] font-mono text-[var(--aurora-text-primary)] break-all">
                    {createdVendor.apiKey}
                  </code>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                    HMAC Secret
                  </label>
                  <code className="block text-sm bg-[var(--aurora-surface-elevated)] p-3 rounded border border-[var(--aurora-border)] font-mono text-[var(--aurora-text-primary)] break-all">
                    {createdVendor.hmacSecret}
                  </code>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                    Webhook URL
                  </label>
                  <code className="block text-sm bg-[var(--aurora-surface-elevated)] p-3 rounded border border-[var(--aurora-border)] font-mono text-[var(--aurora-text-primary)] break-all">
                    {webhookUrl}
                  </code>
                </div>
              </div>
              
              <p className="text-xs text-[var(--aurora-text-muted)] mt-3">
                ⚠️ Save these credentials now. The HMAC secret will not be shown again in full.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Link href={`/sms-vendors/${createdVendor.id}`}>
                <Button variant="primary">View Vendor Details</Button>
              </Link>
              <Link href="/sms-vendors">
                <Button variant="secondary">Back to Vendors</Button>
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Register SMS Vendor"
        description="Register a new vendor for SMS parsing service via MomoTerminal."
      />

      <SectionCard
        title="Vendor Information"
        description="Enter the vendor details to register for SMS parsing service."
      >
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Vendor Name"
            placeholder="e.g., John's Shop"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            required
            helperText="Business or vendor name for identification"
          />

          <Input
            label="Payee MoMo Number"
            placeholder="e.g., +250788123456"
            value={payeeMomoNumber}
            onChange={(e) => setPayeeMomoNumber(e.target.value)}
            required
            helperText="The SIM card number that receives MoMo payments"
          />

          <Input
            label="WhatsApp Number"
            placeholder="e.g., +250788123456"
            value={whatsappE164}
            onChange={(e) => setWhatsappE164(e.target.value)}
            required
            helperText="Used for MomoTerminal registration and portal login"
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Any additional notes about this vendor..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending}
            >
              Register Vendor
            </Button>
            <Link href="/sms-vendors">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
