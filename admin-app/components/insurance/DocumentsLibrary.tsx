"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";
// Live data only; no mock imports
// computed from loaded docs

export function DocumentsLibrary() {
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialIntentId = searchParams?.get("intentId") || "";
  const [intentId, setIntentId] = useState<string>(initialIntentId);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [bucket, setBucket] = useState<string>((process.env.NEXT_PUBLIC_DOCS_BUCKET ?? 'docs').trim());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (intentId) params.set("intentId", intentId);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));
        const res = await fetch(`/api/insurance/documents${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
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
  }, [intentId, page]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => (typeFilter === "all" ? true : (doc.kind ?? doc.docType) === typeFilter));
  }, [documents, typeFilter]);

  const docTypes = useMemo(
    () => Array.from(new Set(documents.map((d: any) => String(d.kind || d.docType || "other")))),
    [documents],
  );

  const selectedDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId) ?? null : null;
  const relatedRequest = null as any;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  async function requestSignedUrl() {
    if (!selectedDoc) return;
    const path = selectedDoc.storagePath ?? selectedDoc.storage_path;
    if (!bucket || !path) return;
    try {
      const res = await fetch(`/api/files/signed-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.url) setPreviewUrl(json.url as string);
    } catch {
      // ignore
    }
  }

  return (
    <SectionCard
      title="Documents library"
      description="Search OCR uploads, signed policies, and supporting docs with verification signals."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
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
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[color:var(--color-muted)]">Intent</label>
          <input
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="intent UUID"
            className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
          />
          <label className="ml-2 text-[color:var(--color-muted)]">Bucket</label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
          >
            <option value="docs">docs</option>
            <option value="operations">operations</option>
            <option value="qr">qr</option>
          </select>
          <button
            type="button"
            className="rounded border border-[color:var(--color-border)] px-3 py-1 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            className="rounded border border-[color:var(--color-border)] px-3 py-1"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
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
                <td className="px-4 py-3">{doc.contactName ?? doc.contactId ?? doc.contact_id ?? "—"}</td>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestSignedUrl}
                className="rounded border border-[color:var(--color-border)] px-3 py-1 text-sm"
              >
                Generate preview link
              </button>
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                >
                  Open preview
                </a>
              ) : null}
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
