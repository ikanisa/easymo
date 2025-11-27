'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, X, Sparkles, Volume2 } from 'lucide-react';
import { useAdvancedHaptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface VoiceOrderProps {
  onOrderDetected: (items: string[]) => void;
  menuItems: string[];
}

type RecognitionState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function VoiceOrder({ onOrderDetected, menuItems }: VoiceOrderProps) {
  const [state, setState] = useState<RecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [detectedItems, setDetectedItems] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const haptics = useAdvancedHaptics();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      haptics.trigger('light');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        processTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setState('error');
      haptics.error();
      setTimeout(() => setState('idle'), 2000);
    };

    recognition.onend = () => {
      if (state === 'listening') {
        setState('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const processTranscript = useCallback((text: string) => {
    setState('processing');
    
    // Simple NLP: Find menu items mentioned in transcript
    const lowerText = text.toLowerCase();
    const found: string[] = [];

    menuItems.forEach(item => {
      if (lowerText.includes(item.toLowerCase())) {
        found.push(item);
      }
    });

    if (found.length > 0) {
      setDetectedItems(found);
      setState('success');
      haptics.orderConfirmed();
      
      setTimeout(() => {
        onOrderDetected(found);
        handleStop();
      }, 1500);
    } else {
      setState('listening');
    }
  }, [menuItems, onOrderDetected, haptics]);

  const handleStart = useCallback(() => {
    if (recognitionRef.current && state === 'idle') {
      setTranscript('');
      setDetectedItems([]);
      recognitionRef.current.start();
    }
  }, [state]);

  const handleStop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState('idle');
      setTranscript('');
      setDetectedItems([]);
    }
  }, []);

  if (!isSupported) {
    return (
      <div className="p-6 rounded-2xl bg-muted/50 border border-border text-center">
        <p className="text-sm text-muted-foreground">
          Voice ordering is not supported in your browser
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Microphone Button */}
      <div className="flex justify-center">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={state === 'idle' ? handleStart : handleStop}
          disabled={state === 'processing'}
          className={cn(
            'relative w-24 h-24 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-300',
            state === 'idle' && 'bg-primary text-primary-foreground hover:bg-primary/90',
            state === 'listening' && 'bg-red-500 text-white animate-pulse',
            state === 'processing' && 'bg-blue-500 text-white',
            state === 'success' && 'bg-green-500 text-white',
            state === 'error' && 'bg-red-600 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <AnimatePresence mode="wait">
            {state === 'idle' && (
              <motion.div
                key="mic"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="w-10 h-10" />
              </motion.div>
            )}
            {state === 'listening' && (
              <motion.div
                key="mic-off"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Volume2 className="w-10 h-10" />
              </motion.div>
            )}
            {state === 'processing' && (
              <motion.div
                key="loader"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Loader2 className="w-10 h-10 animate-spin" />
              </motion.div>
            )}
            {state === 'success' && (
              <motion.div
                key="success"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Sparkles className="w-10 h-10" />
              </motion.div>
            )}
            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <X className="w-10 h-10" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse rings for listening state */}
          {state === 'listening' && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-red-500"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-red-500"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
              />
            </>
          )}
        </motion.button>
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={state}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-lg font-medium"
          >
            {state === 'idle' && 'Tap to start voice ordering'}
            {state === 'listening' && 'Listening... Say your order'}
            {state === 'processing' && 'Processing your order...'}
            {state === 'success' && 'Order detected!'}
            {state === 'error' && 'Error - Please try again'}
          </motion.p>
        </AnimatePresence>

        {/* Live Transcript */}
        {transcript && state === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-xl bg-muted/50 border border-border"
          >
            <p className="text-sm text-muted-foreground italic">&ldquo;{transcript}&rdquo;</p>
          </motion.div>
        )}

        {/* Detected Items */}
        {detectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-2"
          >
            <p className="text-sm text-muted-foreground">Detected items:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {detectedItems.map((item, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {item}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Hints */}
      {state === 'idle' && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            💡 Try saying: &quot;I&apos;d like a pizza and a coke&quot;
          </p>
        </div>
      )}
    </div>
  );
}
