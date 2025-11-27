'use client';

import { QRScanner } from '@/components/venue/QRScanner';
import { useRouter } from 'next/navigation';
import { logStructuredEvent } from '@/lib/observability';
import { useEffect } from 'react';

export default function ScanPage() {
  const router = useRouter();

  useEffect(() => {
    logStructuredEvent('PAGE_VIEW', { page: 'scan' });
  }, []);

  const handleScan = (data: string) => {
    // Scanner component handles navigation
    console.log('Scanned:', data);
  };

  const handleClose = () => {
    router.back();
  };

  return <QRScanner onScan={handleScan} onClose={handleClose} />;
}
