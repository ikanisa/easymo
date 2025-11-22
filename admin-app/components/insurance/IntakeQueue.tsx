"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";

type IntakeRequest = {
  id: string;
  status: string;
  customerName: string;
  customerMsisdn: string;
};

export function IntakeQueue() {
  const [statusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<IntakeRequest | null>(null);
  const requests: IntakeRequest[] = [];

  const filteredRequests = requests.filter((request) => {
    return statusFilter === "all" ? true : request.status === statusFilter;
  });

  return (
    <SectionCard
      title="Intake queue"
      description="Triage new submissions, confirm OCR extracts, and assign ownership across the insurance pod."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          <span className="text-[color:var(--color-muted)]">Showing</span>
          <select
            value={statusFilter}
            onChange={() => {}}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
          >
            <option value="all">All statuses</option>
          </select>
        </div>
        <Button variant="outline" size="sm">
          Export queue
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Request</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {filteredRequests.map((request) => (
              <tr key={request.id} className="cursor-pointer transition hover:bg-[color:var(--color-border)]/20">
                <td className="px-4 py-3">{request.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{request.customerName}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{request.customerMsisdn}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{request.status}</Badge>
                </td>
              </tr>
            ))}
            {!filteredRequests.length && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-[color:var(--color-muted)]">No intake requests.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <Drawer title={`Request ${selectedRequest.id}`} onClose={() => setSelectedRequest(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Customer</p>
              <p className="font-medium">{selectedRequest.customerName}</p>
              <p className="text-xs text-[color:var(--color-muted)]">{selectedRequest.customerMsisdn}</p>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}

