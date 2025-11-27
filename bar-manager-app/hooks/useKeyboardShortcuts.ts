import { useEffect, useCallback, useRef } from 'react';

type ShortcutHandler = () => void;
type ShortcutMap = Record<string, ShortcutHandler>;

/**
 * Advanced keyboard shortcuts system
 * Supports: mod (cmd/ctrl), shift, alt, and key combinations
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape and some shortcuts even in inputs
        if (event.key !== 'Escape' && !event.metaKey && !event.ctrlKey) {
          return;
        }
      }

      // Build key string (e.g., "mod+shift+k")
      const parts: string[] = [];
      if (event.metaKey || event.ctrlKey) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');

      // Add the actual key
      const key = event.key.toLowerCase();
      if (!['control', 'meta', 'shift', 'alt'].includes(key)) {
        parts.push(key);
      }

      const shortcutKey = parts.join('+');

      // Check if we have a handler for this shortcut
      const handler = shortcutsRef.current[shortcutKey];
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Sound effects system
 */
export function useSoundEffects() {
  const [enabled, setEnabled] = useState(true);
  const soundsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Preload sounds
    const sounds = {
      newOrder: '/sounds/new-order.mp3',
      orderReady: '/sounds/order-ready.mp3',
      success: '/sounds/success.mp3',
      error: '/sounds/error.mp3',
      notification: '/sounds/notification.mp3',
    };

    Object.entries(sounds).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      soundsRef.current.set(name, audio);
    });

    return () => {
      soundsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      soundsRef.current.clear();
    };
  }, []);

  const playSound = useCallback(
    (soundName: string) => {
      if (!enabled) return;

      const audio = soundsRef.current.get(soundName);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Sound playback failed:', err));
      }
    },
    [enabled]
  );

  return {
    playSound,
    enabled,
    setEnabled,
  };
}

/**
 * Printer integration hook
 */
export function usePrinter() {
  const printKitchenTicket = useCallback(async (order: any) => {
    // This would use Tauri's invoke to call Rust printer functions
    try {
      // For now, use browser print
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>Kitchen Ticket #${order.order_number}</title>
            <style>
              body { font-family: monospace; padding: 20px; }
              h1 { text-align: center; }
              .item { margin: 10px 0; }
              .qty { font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Order #${order.order_number}</h1>
            <p>Table: ${order.table_number || 'Takeaway'}</p>
            <p>Time: ${new Date().toLocaleTimeString()}</p>
            <hr />
            ${order.items
              .map(
                (item: any) => `
              <div class="item">
                <span class="qty">${item.quantity}x</span> ${item.name}
                ${item.modifiers ? `<br/>&nbsp;&nbsp;&nbsp;+ ${item.modifiers.join(', ')}` : ''}
                ${item.special_instructions ? `<br/>&nbsp;&nbsp;&nbsp;* ${item.special_instructions}` : ''}
              </div>
            `
              )
              .join('')}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Print failed:', error);
    }
  }, []);

  return {
    printKitchenTicket,
  };
}

function useState(arg0: boolean): [any, any] {
  throw new Error('Function not implemented.');
}
