"use client";

import { useMemo, useState } from "react";
import classNames from "classnames";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  InsuranceRequest,
  InsuranceTask,
  InsuranceDocument,
} from "@/lib/schemas";
import {
  mockInsuranceDocuments,
  mockInsuranceRequests,
  mockInsuranceTasks,
} from "@/lib/mock-data";

const statusIntent: Record<InsuranceRequest["status"], { label: string; variant: "success" | "warning" | "destructive" | "outline" | "default" } > = {
  draft: { label: "Draft", variant: "outline" },
  intake: { label: "Intake", variant: "outline" },
  under_review: { label: "Under review", variant: "warning" },
  quoted: { label: "Quoted", variant: "default" },
  awaiting_payment: { label: "Awaiting payment", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  issued: { label: "Issued", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

function deriveNextTask(requestId: string): InsuranceTask | undefined {
  const pendingStatuses: InsuranceTask["status"][] = ["open", "in_progress", "blocked"];
  return mockInsuranceTasks
    .filter((task) => task.requestId === requestId)
    .sort((a, b) => (a.dueAt ?? "") > (b.dueAt ?? "") ? 1 : -1)
    .find((task) => pendingStatuses.includes(task.status));
}

interface RequestWithMeta extends InsuranceRequest {
  nextTask?: InsuranceTask;
  documentCount: number;
}

export function IntakeQueue() {
  const [statusFilter, setStatusFilter] = useState<"all" | InsuranceRequest["status"]>("all");
  const [selectedRequest, setSelectedRequest] = useState<RequestWithMeta | null>(null);

  const requests = useMemo<RequestWithMeta[]>(() => {
    return mockInsuranceRequests.map((request) => ({
      ...request,
      nextTask: deriveNextTask(request.id),
      documentCount: mockInsuranceDocuments.filter((doc) => doc.requestId === request.id).length,
    }));
  }, []);

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
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
          >
            <option value="all">All statuses</option>
            {Object.entries(statusIntent).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
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
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-left">OCR confidence</th>
              <th className="px-4 py-3 text-left">Assigned</th>
              <th className="px-4 py-3 text-left">Next task</th>
              <th className="px-4 py-3 text-left">Documents</th>
              <th className="px-4 py-3 text-left">Premium target</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {filteredRequests.map((request) => (
              <tr
                key={request.id}
                className="cursor-pointer transition hover:bg-[color:var(--color-border)]/20"
                onClick={() => setSelectedRequest(request)}
              >
                <td className="px-4 py-3 font-medium">{request.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{request.customerName}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{request.customerMsisdn}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{[request.vehicle?.make, request.vehicle?.model].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{request.vehicle?.plateNumber || "Pending"}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={classNames(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
                      request.ocrConfidence && request.ocrConfidence >= 0.85
                        ? "bg-emerald-100 text-emerald-700"
                        : request.ocrConfidence && request.ocrConfidence >= 0.65
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {request.ocrConfidence ? `${Math.round(request.ocrConfidence * 100)}%` : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">{request.assignedAgentId || "Unassigned"}</td>
                <td className="px-4 py-3">
                  {request.nextTask ? (
                    <div>
                      <div className="font-medium">{request.nextTask.title}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">
                        Due {request.nextTask.dueAt ? new Date(request.nextTask.dueAt).toLocaleDateString() : "TBD"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-[color:var(--color-muted)]">No pending tasks</span>
                  )}
                </td>
                <td className="px-4 py-3">{request.documentCount}</td>
                <td className="px-4 py-3">{request.premiumTargetMinor ? formatCurrency(request.premiumTargetMinor) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusIntent[request.status].variant}>
                    {statusIntent[request.status].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <Drawer
          title={`Request ${selectedRequest.id}`}
          onClose={() => setSelectedRequest(null)}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Customer
              </p>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-medium">{selectedRequest.customerName}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{selectedRequest.customerMsisdn}</p>
                </div>
                <Badge variant={statusIntent[selectedRequest.status].variant}>
                  {statusIntent[selectedRequest.status].label}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Vehicle</p>
              <dl className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <dt className="text-[color:var(--color-muted)]">Plate</dt>
                  <dd className="font-medium">{selectedRequest.vehicle?.plateNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Make / model</dt>
                  <dd className="font-medium">
                    {[selectedRequest.vehicle?.make, selectedRequest.vehicle?.model].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Cover</dt>
                  <dd>{selectedRequest.coverType}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-muted)]">Usage</dt>
                  <dd>{selectedRequest.usage}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Documents</p>
              <ul className="space-y-1 pt-2">
                {mockInsuranceDocuments
                  .filter((doc) => doc.requestId === selectedRequest.id)
                  .map((doc: InsuranceDocument) => (
                    <li key={doc.id} className="flex items-center justify-between">
                      <span>{doc.docType}</span>
                      <span className="text-xs text-[color:var(--color-muted)]">
                        {doc.verified ? "Verified" : `${Math.round((doc.ocrConfidence ?? 0) * 100)}%`}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Next actions</p>
              <ul className="list-disc space-y-1 pl-4 pt-2">
                <li>Confirm OCR mismatches before quoting.</li>
                <li>Align on preferred insurer and share MoMo instructions.</li>
                <li>Sync updates to Supabase via requests/tasks tables.</li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
