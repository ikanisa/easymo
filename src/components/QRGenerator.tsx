interface QRGeneratorProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRGenerator({ value, size = 200, className }: QRGeneratorProps) {
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
    <div
      className={`bg-muted/20 border rounded-lg flex flex-col items-center justify-center space-y-2 text-center px-4 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-sm font-medium">QR unavailable in this build</span>
      <span className="text-xs text-muted-foreground break-all">{value}</span>
    </div>
  );
}
