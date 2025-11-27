"use client";

import clsx from "clsx";
import { ChangeEvent } from "react";

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  status: "processing" | "ready" | "failed";
  updatedAt: string;
}

export interface KnowledgeUploadProps {
  documents: KnowledgeDocument[];
  onUpload?: (files: FileList) => void;
  className?: string;
}

const statusAccent: Record<KnowledgeDocument["status"], string> = {
  processing: "text-amber-600",
  ready: "text-emerald-600",
  failed: "text-rose-600",
};

export function KnowledgeUpload({ documents, onUpload, className }: KnowledgeUploadProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      onUpload?.(event.target.files);
      event.target.value = "";
    }
  }

  return (
    <section
      className={clsx(
        "flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Knowledge base</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Upload PDFs, spreadsheets, and transcripts to retrain the agent.</p>
      </div>
      <label
        className={clsx(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500 transition hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-900",
          !onUpload && "cursor-not-allowed opacity-70",
        )}
      >
        <span className="text-lg">⇪</span>
        <span>Drop knowledge files here or browse</span>
        <input type="file" className="sr-only" multiple onChange={handleChange} disabled={!onUpload} />
      </label>
      <div className="flex-1 overflow-hidden">
        <ul className="flex h-full flex-col gap-2 overflow-y-auto pr-1 text-sm">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-800/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700 dark:text-slate-200">{doc.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {doc.size} • Updated {new Date(doc.updatedAt).toLocaleString()}
                </p>
              </div>
              <span className={clsx("text-xs font-semibold capitalize", statusAccent[doc.status] ?? "text-slate-500")}> 
                {doc.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

