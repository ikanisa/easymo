'use client';

import { CsvUpload } from '@/components/uploads/CsvUpload';

interface VoucherCsvUploadProps {
  instructions: string;
}

export function VoucherCsvUpload({ instructions }: VoucherCsvUploadProps) {
  return (
    <CsvUpload
      instructions={instructions}
      onPreview={(rows) => console.info('Preview rows', rows.length)}
    />
  );
}
