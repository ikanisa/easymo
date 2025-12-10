/**
 * Print Manager Component
 * Configure and manage thermal printers
 */

'use client';

import { useState } from 'react';
import { Printer, Check, X, TestTube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrinterConfig, ReceiptBuilder, printQueue } from '@/lib/printer/thermal';
import { Button } from './ui/Button';

interface PrintManagerProps {
  printers: PrinterConfig[];
  onTest?: (printerId: string) => void;
  onToggle?: (printerId: string, enabled: boolean) => void;
}

export function PrintManager({ printers, onTest, onToggle }: PrintManagerProps) {
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = async (printer: PrinterConfig) => {
    setTesting(printer.id);
    
    try {
      // Build test receipt
      const builder = new ReceiptBuilder(printer);
      const content = builder
        .init()
        .center()
        .bold()
        .doubleSize()
        .text('PRINTER TEST')
        .normal()
        .newLine(2)
        .left()
        .text(`Printer: ${printer.name}`)
        .text(`Type: ${printer.type}`)
        .text(`Paper: ${printer.paperWidth}mm`)
        .text(`Date: ${new Date().toLocaleString()}`)
        .newLine()
        .separator()
        .center()
        .text('✓ Printer is working correctly')
        .newLine(3)
        .feed(2)
        .cut()
        .build();

      // Add to print queue
      await printQueue.add(printer, content, 10);
      
      onTest?.(printer.id);
    } finally {
      setTimeout(() => setTesting(null), 1000);
    }
  };

  return (
    <div className="space-y-3">
      {printers.map((printer) => (
        <div
          key={printer.id}
          className={cn(
            'p-4 rounded-lg border transition-colors',
            printer.isEnabled
              ? 'bg-card border-border'
              : 'bg-muted/30 border-muted opacity-60'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                printer.isEnabled ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Printer className={cn(
                  'w-5 h-5',
                  printer.isEnabled ? 'text-primary' : 'text-muted-foreground'
                )} />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{printer.name}</h4>
                  {printer.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {printer.type.charAt(0).toUpperCase() + printer.type.slice(1)} • {printer.paperWidth}mm
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {printer.isEnabled ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        Online
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 text-red-500" />
                        Offline
                      </>
                    )}
                  </span>
                  <span>Queue: {printQueue.getQueueLength()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTest(printer)}
                disabled={!printer.isEnabled || testing === printer.id}
                className="gap-2"
              >
                <TestTube className="w-4 h-4" />
                {testing === printer.id ? 'Testing...' : 'Test Print'}
              </Button>
              
              <button
                onClick={() => onToggle?.(printer.id, !printer.isEnabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  printer.isEnabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    printer.isEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
