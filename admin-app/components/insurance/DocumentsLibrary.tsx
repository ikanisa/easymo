"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { mockInsuranceDocuments, mockInsuranceRequests } from "@/lib/mock-data";

const docTypes = Array.from(new Set(mockInsuranceDocuments.map((doc) => doc.docType)));

export function DocumentsLibrary() {
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const documents = useMemo(() => {
    return mockInsuranceDocuments.filter((doc) =>
      typeFilter === "all" ? true : doc.docType === typeFilter,
    );
  }, [typeFilter]);

  const selectedDoc = selectedDocId
    ? mockInsuranceDocuments.find((doc) => doc.id === selectedDocId) ?? null
    : null;
  const relatedRequest = selectedDoc
    ? mockInsuranceRequests.find((request) => request.id === selectedDoc.requestId)
    : null;

  return (
    <SectionCard
      title="Documents library"
      description="Search OCR uploads, signed policies, and supporting docs with verification signals."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label className="text-[color:var(--color-muted)]">Filter by type</label>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
        >
          <option value="all">All</option>
          {docTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Request</th>
              <th className="px-4 py-3 text-left">Uploaded by</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-left">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                onClick={() => setSelectedDocId(doc.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{doc.docType}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{doc.storagePath}</div>
                </td>
                <td className="px-4 py-3">{doc.requestId ?? "—"}</td>
                <td className="px-4 py-3">{doc.uploadedBy ?? "—"}</td>
                <td className="px-4 py-3">{doc.ocrConfidence ? `${Math.round(doc.ocrConfidence * 100)}%` : "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={doc.verified ? "success" : "outline"}>
                    {doc.verified ? "Verified" : "Pending"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDoc && (
        <Drawer title={`Document ${selectedDoc.id}`} onClose={() => setSelectedDocId(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Request link</p>
              <p className="font-medium">{selectedDoc.requestId ?? "Unlinked"}</p>
              {relatedRequest && (
                <p className="text-xs text-[color:var(--color-muted)]">
                  {relatedRequest.customerName} • {relatedRequest.status.replace(/_/g, " ")}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">OCR payload</p>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-[color:var(--color-surface-muted)] p-3 text-xs">
                {JSON.stringify(selectedDoc.ocrPayload, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Meta</p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Uploaded</span>
                  <span>{new Date(selectedDoc.uploadedAt).toLocaleString()}</span>
                </li>
                <li className="flex justify-between">
                  <span>Source</span>
                  <span>{selectedDoc.source ?? "upload"}</span>
                </li>
                <li className="flex justify-between">
                  <span>Confidence</span>
                  <span>{selectedDoc.ocrConfidence ? `${Math.round(selectedDoc.ocrConfidence * 100)}%` : "Pending"}</span>
                </li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
