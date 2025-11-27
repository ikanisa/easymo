'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, AlertCircle, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { Button } from '@/components/ui/Button';
import { logStructuredEvent } from '@/lib/observability';

interface QRScannerProps {
  onScan?: (data: string) => void;
  onClose?: () => void;
  overlay?: boolean;
}

export function QRScanner({ onScan, onClose, overlay = true }: QRScannerProps) {
  const router = useRouter();
  const { trigger } = useHaptics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const handleQRDetected = useCallback(
    async (result: QrScanner.ScanResult) => {
      const data = result.data;

      // Vibrate on successful scan
      trigger('success');

      await logStructuredEvent('QR_CODE_SCANNED', {
        data: data.substring(0, 50), // Log first 50 chars only
      });

      // Parse QR code data
      if (data.includes('easymo.app') || data.includes('localhost')) {
        // Extract venue slug from URL
        // Example: https://order.easymo.app/heaven-bar?table=5
        const url = new URL(data);
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        if (pathParts.length > 0) {
          const venueSlug = pathParts[0];
          const tableNumber = url.searchParams.get('table');
          
          // Stop scanner before navigation
          scannerRef.current?.stop();
          
          // Navigate to venue page
          const targetUrl = tableNumber
            ? `/${venueSlug}?table=${tableNumber}`
            : `/${venueSlug}`;
          
          await logStructuredEvent('QR_NAVIGATION', {
            venueSlug,
            tableNumber,
          });
          
          router.push(targetUrl);
          onScan?.(data);
        } else {
          setError('Invalid QR code. Please scan a valid venue QR code.');
        }
      } else {
        setError('This QR code is not recognized. Please scan an EasyMO venue QR code.');
      }
    },
    [router, trigger, onScan]
  );

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      // Check camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // Stop test stream
      
      setHasPermission(true);
      setScanning(true);

      // Initialize QR scanner
      const scanner = new QrScanner(
        videoRef.current,
        (result) => handleQRDetected(result),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Back camera on mobile
        }
      );

      scannerRef.current = scanner;
      await scanner.start();

      await logStructuredEvent('QR_SCANNER_STARTED', {});
    } catch (err) {
      console.error('QR Scanner error:', err);
      setHasPermission(false);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Failed to start camera. Please try again.');
        }
      }

      await logStructuredEvent('QR_SCANNER_ERROR', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [handleQRDetected]);

  const stopScanner = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose?.();
  }, [stopScanner, onClose]);

  // Start scanner on mount
  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, [startScanner, stopScanner]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black',
        overlay && 'flex items-center justify-center'
      )}
    >
      {/* Video feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Scanning overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Close button */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
          <h1 className="text-white text-lg font-semibold">Scan QR Code</h1>
          {onClose && (
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
          )}
        </div>

        {/* Scan frame */}
        <div className="relative">
          {/* Animated scanning line */}
          {scanning && (
            <motion.div
              className="absolute inset-0 border-2 border-primary rounded-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.div
                className="absolute inset-x-0 h-0.5 bg-primary shadow-glow"
                animate={{
                  y: [0, 250, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            </motion.div>
          )}

          {/* Corner markers */}
          <div className="relative w-64 h-64">
            {[
              'top-0 left-0',
              'top-0 right-0',
              'bottom-0 left-0',
              'bottom-0 right-0',
            ].map((position, i) => (
              <div
                key={i}
                className={cn(
                  'absolute w-8 h-8 border-primary',
                  position,
                  i === 0 && 'border-t-4 border-l-4',
                  i === 1 && 'border-t-4 border-r-4',
                  i === 2 && 'border-b-4 border-l-4',
                  i === 3 && 'border-b-4 border-r-4'
                )}
              />
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 text-sm">{error}</p>
                  {hasPermission === false && (
                    <Button
                      onClick={startScanner}
                      variant="outline"
                      size="sm"
                      className="mt-3 border-red-500/30 text-red-400"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : scanning ? (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  <p className="text-white text-sm font-medium">
                    Ready to scan
                  </p>
                </div>
                <p className="text-white/70 text-xs">
                  Position the QR code within the frame
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-center gap-3"
              >
                <Camera className="w-5 h-5 text-white/70 animate-pulse" />
                <p className="text-white/70 text-sm">Starting camera...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
