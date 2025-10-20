"use client";

import { CsvUpload } from "@/components/uploads/CsvUpload";

interface VoucherCsvUploadProps {
  instructions: string;
}

export function VoucherCsvUpload({ instructions }: VoucherCsvUploadProps) {
  return (
    <CsvUpload
      instructions={instructions}
      onPreview={(rows) => console.warn("voucher_csv_preview", { rowCount: rows.length })}
    />
  );
}
