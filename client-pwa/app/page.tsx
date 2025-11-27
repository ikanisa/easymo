import Link from 'next/link';
import { QrCode, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-background/80">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
        </div>

        {/* Hero Text */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome to EasyMO
          </h1>
          <p className="text-lg text-muted-foreground">
            Scan, order, and pay in seconds
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-4 pt-8">
          <Link
            href="/demo"
            className="w-full btn-touch bg-primary text-primary-foreground rounded-2xl font-semibold text-lg shadow-glow flex items-center justify-center gap-2"
          >
            <Sparkles className="w-6 h-6" />
            View Demo
          </Link>

          <Link
            href="/scan"
            className="w-full btn-touch bg-secondary text-secondary-foreground rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
          >
            <QrCode className="w-6 h-6" />
            Scan QR Code
          </Link>

          <div className="text-sm text-muted-foreground">
            Try the demo or scan a table QR code
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 pt-12">
          <div className="space-y-2">
            <div className="text-3xl">📱</div>
            <div className="text-xs text-muted-foreground">Scan QR</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🍕</div>
            <div className="text-xs text-muted-foreground">Browse Menu</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">💳</div>
            <div className="text-xs text-muted-foreground">Quick Pay</div>
          </div>
        </div>
      </div>
    </main>
  );
}
