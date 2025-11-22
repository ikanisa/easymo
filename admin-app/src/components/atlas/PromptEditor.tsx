"use client";

import clsx from "clsx";
import { FormEvent, useId, useState } from "react";

export interface PromptEditorProps {
  value?: string;
  placeholder?: string;
  label?: string;
  helperText?: string;
  suggestions?: string[];
  onSubmit?: (value: string) => void;
  className?: string;
}

export function PromptEditor({
  value = "",
  placeholder = "Outline the next best action…",
  label = "Prompt",
  helperText,
  suggestions = [],
  onSubmit,
  className,
}: PromptEditorProps) {
  const [draft, setDraft] = useState(value);
  const generatedId = useId();
  const textareaId = "prompt-editor-" + generatedId;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSubmit?.(draft.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        "flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-100" htmlFor={textareaId}>
            {label}
          </label>
          {helperText ? <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p> : null}
        </div>
        <button
          type="submit"
          className="rounded-full border border-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
        >
          Run
        </button>
      </div>
      <textarea
        id={textareaId}
        className="min-h-[140px] flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm leading-relaxed text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {suggestions.length ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-800/40 dark:text-slate-400">
          <p className="mb-2 font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Suggestions</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-900"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

