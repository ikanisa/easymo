import { useCallback } from 'react';

export function usePrinter() {
  const printKitchenTicket = useCallback(async (order: any) => {
    try {
      // For now, use browser print
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>Kitchen Ticket #${order.order_number}</title>
            <style>
              @media print {
                body { margin: 0; padding: 10mm; font-family: monospace; font-size: 12pt; }
                h1 { font-size: 24pt; margin: 0 0 5mm 0; }
                .item { margin: 3mm 0; }
                .modifier { margin-left: 5mm; font-size: 10pt; }
              }
            </style>
          </head>
          <body>
            <h1>Order #${order.order_number}</h1>
            <p><strong>Table:</strong> ${order.table_number || 'Takeaway'}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
            <hr />
            ${order.items.map((item: any) => `
              <div class="item">
                <strong>${item.quantity}x ${item.name}</strong>
                ${item.modifiers?.map((m: string) => `<div class="modifier">+ ${m}</div>`).join('') || ''}
                ${item.special_instructions ? `<div class="modifier">* ${item.special_instructions}</div>` : ''}
              </div>
            `).join('')}
            ${order.notes ? `<hr /><p><strong>Notes:</strong> ${order.notes}</p>` : ''}
          </body>
        </html>
      `);

      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error('Print failed:', error);
    }
  }, []);

  return {
    printKitchenTicket,
  };
}
