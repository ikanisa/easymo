'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function QRScanner() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error('Camera permission denied:', err);
        setHasPermission(false);
        setError('Camera permission is required to scan QR codes');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulate QR code detection for demo
  const handleManualInput = (venue: string, table?: string) => {
    const url = table ? `/${venue}?table=${table}` : `/${venue}`;
    router.push(url);
  };

  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Camera Access Required</h2>
        <p className="text-muted-foreground text-center mb-6">
          Please enable camera permissions to scan QR codes
        </p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="safe-area-top bg-black/50 backdrop-blur-xl border-b border-white/10 z-20">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-white">Scan QR Code</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Scanning Frame */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-64 h-64">
            {/* Corner Brackets */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl" />
            
            {/* Scanning Line Animation */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-1 bg-primary/50 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-center mb-4">
            Point your camera at the table QR code
          </p>
        </div>
      </div>

      {/* Demo/Manual Entry */}
      <div className="safe-area-bottom bg-background p-4 space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          For demo purposes, try these:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => handleManualInput('heaven-bar', '5')}
          >
            Heaven Bar - Table 5
          </Button>
          <Button
            variant="outline"
            onClick={() => handleManualInput('heaven-bar', '12')}
          >
            Heaven Bar - Table 12
          </Button>
        </div>
      </div>
    </div>
  );
}
