"use client";

import { useState } from "react";
import Papa from "papaparse";
import styles from "./CsvUpload.module.css";

interface CsvUploadProps<T = Record<string, unknown>> {
  accept?: string;
  onPreview: (rows: T[]) => void;
  instructions?: string;
}

export function CsvUpload<T = Record<string, unknown>>({
  accept = ".csv",
  onPreview,
  instructions = "Upload a CSV file. The first row should contain headers.",
}: CsvUploadProps<T>) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: any) => {
        if (result.errors.length) {
          setError(result.errors.map((err: any) => err.message).join(", "));
          return;
        }
        onPreview(result.data as T[]);
      },
      error: (parseError: any) => {
        setError(parseError.message);
      },
    });
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.uploader}>
        <input type="file" accept={accept} onChange={handleFileChange} />
        <span>Upload CSV</span>
      </label>
      <div className={styles.meta}>
        <p>{instructions}</p>
        {fileName ? <p className={styles.file}>Selected: {fileName}</p> : null}
        {error ? <p className={styles.error}>Error: {error}</p> : null}
      </div>
    </div>
  );
}
