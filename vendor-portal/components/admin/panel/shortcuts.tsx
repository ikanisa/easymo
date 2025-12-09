"use client";

import { useEffect } from "react";

import { useCommandPaletteActions } from "@/src/components/common/CommandPalette";

type ShortcutAction = "approve" | "reject" | "merge";

export type AdminPanelShortcutDetail = {
  action: ShortcutAction;
};

const APPROVAL_KEYS = new Map<string, ShortcutAction>([
  ["a", "approve"],
  ["r", "reject"],
  ["m", "merge"],
]);

const ACTION_LABELS: Record<ShortcutAction, { label: string; description: string }> = {
  approve: {
    label: "Approve selected request",
    description: "Confirm the highlighted approval or invite.",
  },
  reject: {
    label: "Reject selected request",
    description: "Decline the highlighted approval or invite.",
  },
  merge: {
    label: "Merge duplicate records",
    description: "Start the merge workflow for selected records.",
  },
};

export function AdminPanelShortcuts({ children }: { children: React.ReactNode }) {
  useCommandPaletteActions(() =>
    Array.from(APPROVAL_KEYS.entries()).map(([key, action]) => {
      const info = ACTION_LABELS[action];
      return {
        id: `admin-shortcut:${action}`,
        label: info.label,
        description: info.description,
        secondaryLabel: `Shortcut ${key.toUpperCase()}`,
        keywords: [action, key.toUpperCase(), info.label],
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent<AdminPanelShortcutDetail>("admin-panel:shortcut", {
              detail: { action },
            })
          );
        },
      };
    })
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const action = APPROVAL_KEYS.get(key);
      if (!action) return;
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("admin-panel:shortcut", {
          detail: { action },
        })
      );
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <>{children}</>;
}
