'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface QrBatchDownloaderProps {
  tokens: {
    id: string;
    tableLabel: string;
    token: string;
    qrImageUrl?: string | null;
  }[];
  barName: string;
}

export function QrBatchDownloader({ tokens, barName }: QrBatchDownloaderProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const tokenIds = tokens.map(t => t.id);
      
      const response = await fetch('/api/qr/download-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenIds,
          format: 'png',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Download failed');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${barName.replace(/[^a-z0-9]/gi, '_')}_QR_Codes.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('QR batch download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const hasImages = tokens.some(t => t.qrImageUrl);

  if (!hasImages) {
    return (
      <div className="text-sm text-gray-500">
        No QR images available for download. Regenerate tokens to create images.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDownload}
        disabled={isDownloading || tokens.length === 0}
        variant="outline"
      >
        {isDownloading ? 'Downloading...' : `Download All QR Codes (${tokens.length})`}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        Downloads a ZIP file containing {tokens.length} QR code image{tokens.length !== 1 ? 's' : ''} and metadata.
      </p>
    </div>
  );
}
