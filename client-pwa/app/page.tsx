export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold text-primary">
          🍽️ EasyMO
        </h1>
        <p className="text-2xl text-muted-foreground max-w-md">
          Scan a QR code to get started
        </p>
        <div className="text-sm text-muted-foreground/60 space-y-2">
          <p>Bar & Restaurant Client PWA</p>
          <p>Version 1.0.0</p>
        </div>
      </div>
    </main>
  );
}
