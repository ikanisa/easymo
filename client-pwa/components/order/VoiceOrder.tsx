'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, X, Sparkles } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

interface VoiceOrderProps {
  venueId: string;
  onOrderProcessed?: (items: any[]) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function VoiceOrder({ venueId, onOrderProcessed }: VoiceOrderProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const { trigger, addToCart: hapticAddToCart } = useHaptics();
  const { addItem } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError('Could not understand. Please try again.');
      setState('error');
      trigger('error');
    };

    recognition.onend = () => {
      if (state === 'listening') {
        processVoiceOrder(transcript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;

    setTranscript('');
    setError(null);
    setParsedItems([]);
    setState('listening');
    trigger('medium');

    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already started
    }
  }, [trigger]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setState('processing');
  }, []);

  const processVoiceOrder = async (text: string) => {
    if (!text.trim()) {
      setState('idle');
      return;
    }

    setState('processing');
    trigger('light');

    try {
      const response = await fetch('/api/voice-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId,
          transcript: text,
        }),
      });

      if (!response.ok) throw new Error('Failed to process order');

      const { items, message } = await response.json();

      if (items && items.length > 0) {
        setParsedItems(items);
        setState('success');
        hapticAddToCart();

        for (const item of items) {
          addItem(item.menuItem, item.quantity);
        }

        onOrderProcessed?.(items);
      } else {
        setError(message || 'Could not find those items. Please try again.');
        setState('error');
        trigger('error');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setState('error');
      trigger('error');
    }
  };

  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setError(null);
    setParsedItems([]);
  }, []);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={state === 'listening' ? stopListening : startListening}
        disabled={state === 'processing'}
        className={cn(
          'fixed bottom-24 left-4 z-40',
          'w-14 h-14 rounded-full shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-300',
          state === 'listening' && 'bg-red-500 animate-pulse',
          state === 'processing' && 'bg-yellow-500',
          state === 'idle' && 'bg-primary',
          'text-white'
        )}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        {state === 'processing' ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : state === 'listening' ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </motion.button>

      <AnimatePresence>
        {(state === 'listening' || state === 'processing' || state === 'success' || state === 'error') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && reset()}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-card rounded-t-3xl p-6 pb-safe"
            >
              <button
                onClick={reset}
                className="absolute top-4 right-4 p-2 rounded-full bg-muted"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-6">
                {state === 'listening' && (
                  <div className="flex justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                        className="w-14 h-14 rounded-full bg-red-500/40 flex items-center justify-center"
                      >
                        <Mic className="w-8 h-8 text-red-500" />
                      </motion.div>
                    </motion.div>
                  </div>
                )}

                {state === 'processing' && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <p className="text-lg font-medium">Processing your order...</p>
                  </div>
                )}

                {(state === 'listening' || state === 'processing') && transcript && (
                  <div className="bg-muted rounded-2xl p-4">
                    <p className="text-lg">&quot;{transcript}&quot;</p>
                  </div>
                )}

                {state === 'success' && (
                  <div className="space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center"
                    >
                      <span className="text-4xl">✓</span>
                    </motion.div>
                    <p className="text-lg font-medium">Added to cart!</p>
                    <div className="space-y-2">
                      {parsedItems.map((item, i) => (
                        <div key={i} className="flex justify-between bg-muted rounded-xl p-3">
                          <span>{item.quantity}x {item.menuItem.name}</span>
                          <span className="font-semibold">{item.menuItem.price} RWF</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {state === 'error' && (
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-4xl">❌</span>
                    </div>
                    <p className="text-lg text-red-500">{error}</p>
                    <button
                      onClick={startListening}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {state === 'listening' && (
                  <p className="text-muted-foreground">
                    Say something like &quot;I&apos;d like 2 beers and a pizza&quot;
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
