import { useState, useCallback, useRef } from 'react';

interface GeminiConfig {
  systemPrompt?: string;
  model?: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash-exp';
  temperature?: number;
  maxTokens?: number;
}

interface UseGeminiAIReturn {
  sendMessage: (message: string) => Promise<string>;
  streamMessage: (message: string, onChunk: (chunk: string) => void) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  abortRequest: () => void;
  contextWindow: Message[];
  clearContext: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function useGeminiAI(config: GeminiConfig = {}): UseGeminiAIReturn {
  const {
    systemPrompt = 'You are a helpful AI assistant.',
    model = 'gemini-1.5-flash',
    temperature = 0.7,
    maxTokens = 2048,
  } = config;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextWindow, setContextWindow] = useState<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getApiKey = useCallback(async (): Promise<string> => {
    // Try environment variable first (for web/PWA)
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    }

    // Try Tauri secure storage (for desktop)
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const key = await invoke<string>('get_secure_credentials', { key: 'gemini_api_key' });
        if (key) return key;
      } catch (err) {
        console.warn('Failed to get API key from Tauri:', err);
      }
    }

    throw new Error('Gemini API key not configured. Please add it in Settings.');
  }, []);

  const sendMessage = useCallback(async (message: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const apiKey = await getApiKey();
        
        const messages = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...contextWindow.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
          { role: 'user', parts: [{ text: message }] },
        ];

        const response = await fetch(
          `${GEMINI_API_BASE}/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: messages,
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
          );
        }

        const data = await response.json();
        const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!assistantMessage) {
          throw new Error('Empty response from Gemini API');
        }

        // Update context window (keep last 20 messages)
        setContextWindow(prev => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage },
        ].slice(-20));

        return assistantMessage;
      } catch (err) {
        retries++;
        if (retries >= MAX_RETRIES) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          throw err;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
      } finally {
        if (retries >= MAX_RETRIES) {
          setIsLoading(false);
        }
      }
    }

    throw new Error('Max retries exceeded');
  }, [systemPrompt, model, temperature, maxTokens, contextWindow, getApiKey]);

  const streamMessage = useCallback(async (
    message: string,
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const apiKey = await getApiKey();

      const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...contextWindow.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text) {
                fullResponse += text;
                onChunk(text);
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Update context window
      setContextWindow(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: fullResponse },
      ].slice(-20));

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, not an error
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [systemPrompt, model, temperature, maxTokens, contextWindow, getApiKey]);

  const abortRequest = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearContext = useCallback(() => {
    setContextWindow([]);
  }, []);

  return {
    sendMessage,
    streamMessage,
    isLoading,
    error,
    abortRequest,
    contextWindow,
    clearContext,
  };
}
