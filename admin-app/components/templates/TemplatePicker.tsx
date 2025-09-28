"use client";

import { useState } from "react";
import type { TemplateMeta } from "@/lib/schemas";
import styles from "./TemplatePicker.module.css";

interface TemplatePickerProps {
  templates: TemplateMeta[];
  value?: string;
  onChange?: (templateId: string) => void;
}

export function TemplatePicker(
  { templates, value, onChange }: TemplatePickerProps,
) {
  const [selected, setSelected] = useState<string | undefined>(value);

  const handleSelect = (templateId: string) => {
    setSelected(templateId);
    onChange?.(templateId);
  };

  return (
    <div className={styles.wrapper} role="listbox" aria-label="Template picker">
      {templates.map((template) => (
        <button
          type="button"
          key={template.id}
          className={selected === template.id ? styles.cardActive : styles.card}
          onClick={() => handleSelect(template.id)}
          role="option"
          aria-selected={selected === template.id}
        >
          <div className={styles.cardHeader}>
            <h3>{template.name}</h3>
            <span className={styles.status}>{template.status}</span>
          </div>
          <p className={styles.purpose}>{template.purpose}</p>
          <p className={styles.meta}>
            Locales: {template.locales.join(", ") || "—"}
          </p>
          <p className={styles.meta}>
            Variables: {template.variables.join(", ") || "—"}
          </p>
        </button>
      ))}
    </div>
  );
}
