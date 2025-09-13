import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRGeneratorProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRGenerator({ value, size = 200, className }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { 
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) {
          console.error('QR Code generation error:', error);
        }
      });
    }
  }, [value, size]);

  if (!value) {
    return (
      <div 
        className={`bg-muted/50 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-muted-foreground text-sm">No QR data</span>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      className={`border rounded-lg ${className}`}
    />
  );
}