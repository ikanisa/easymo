"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
// Live data only; no mock imports
// computed from loaded docs

export function DocumentsLibrary() {
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/insurance/documents", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load documents");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        if (mounted) setDocuments(data);
        // types computed via useMemo downstream
      } catch {
        if (mounted) setDocuments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return documents.filter((doc) => (typeFilter === "all" ? true : (doc.kind ?? doc.docType) === typeFilter));
  }, [documents, typeFilter]);

  const docTypes = useMemo(
    () => Array.from(new Set(documents.map((d: any) => String(d.kind || d.docType || "other")))),
    [documents],
  );

  const selectedDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId) ?? null : null;
  const relatedRequest = null as any;

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
            {filtered.map((doc) => (
              <tr
                key={doc.id}
                className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                onClick={() => setSelectedDocId(doc.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{doc.kind ?? doc.docType ?? "other"}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{doc.storagePath ?? doc.storage_path}</div>
                </td>
                <td className="px-4 py-3">{doc.intentId ?? doc.intent_id ?? "—"}</td>
                <td className="px-4 py-3">{doc.contactId ?? doc.contact_id ?? "—"}</td>
                <td className="px-4 py-3">{doc.ocrConfidence ? `${Math.round(Number(doc.ocrConfidence) * 100)}%` : "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={(doc.ocrState ?? doc.ocr_state) === 'verified' ? "success" : "outline"}>
                    {(doc.ocrState ?? doc.ocr_state) === 'verified' ? "Verified" : "Pending"}
                  </Badge>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[color:var(--color-muted)]">{loading ? "Loading…" : "No documents found."}</td>
              </tr>
            )}
            {!documents.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[color:var(--color-muted)]">No documents found.</td>
              </tr>
            )}
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
