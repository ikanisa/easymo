import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  X, 
  Copy, 
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Loader2,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  FileText,
} from 'lucide-react';
import { useGeminiAI } from '@/lib/hooks/use-gemini-ai';
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition';
import { Markdown } from '@/components/ui/markdown';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
    actions?: AIAction[];
  };
}

interface AIAction {
  type: 'navigate' | 'query' | 'export' | 'alert';
  label: string;
  payload: unknown;
}

interface AIAssistantPanelProps {
  onClose: () => void;
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Today's Summary",
    prompt: "Give me a summary of today's SACCO activities including collections, payments, and any issues.",
  },
  {
    icon: AlertTriangle,
    label: "Pending Issues",
    prompt: "List all pending reconciliation exceptions and members with overdue payments.",
  },
  {
    icon: Lightbulb,
    label: "Insights",
    prompt: "Analyze collection trends and provide insights on how to improve member engagement.",
  },
  {
    icon: FileText,
    label: "Generate Report",
    prompt: "Generate a weekly performance report for the SACCO management.",
  },
];

export function AIAssistantPanel({ onClose }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your SACCO AI Assistant powered by Gemini. 

I can help you with:
- **Analyzing data** - Collections, payments, member statistics
- **Generating reports** - Daily, weekly, monthly summaries
- **Finding information** - Member details, payment history
- **Providing insights** - Trends, forecasts, recommendations

How can I assist you today?`,
      timestamp: new Date(),
      status: 'complete',
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    sendMessage, 
    streamMessage, 
    isLoading, 
    abortRequest,
    contextWindow,
  } = useGeminiAI({
    systemPrompt: `You are an AI assistant for a SACCO (Savings and Credit Cooperative) staff admin application in Rwanda. 

Your role is to help staff members:
1. Understand member data and payment patterns
2. Identify reconciliation issues
3. Generate insights and reports
4. Answer questions about SACCO operations

Always be helpful, accurate, and provide actionable insights. Format your responses with markdown for clarity. 

Current context:
- Application: Ibimina SACCO+ Staff Admin
- User role: Staff member
- Capabilities: Access to member data, payment records, reconciliation status`,
  });

  const { 
    startListening, 
    stopListening, 
    transcript, 
    isSupported: speechSupported,
    resetTranscript,
  } = useSpeechRecognition();

  // Auto-scroll to bottom with RAF for better timing
  useEffect(() => {
    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    };
    scrollToBottom();
  }, [messages]);

  // Handle speech transcript
  useEffect(() => {
    if (transcript) {
      setInput(prev => prev + transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      status: 'complete',
    };

    const assistantMessage: Message = {
      id: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'streaming',
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');

    try {
      let fullResponse = '';
      
      await streamMessage(input.trim(), (chunk) => {
        fullResponse += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: fullResponse } 
              : msg
          )
        );
      });

      // Parse any actions from the response
      const actions = parseActionsFromResponse(fullResponse);

      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                status: 'complete',
                metadata: { actions }
              } 
            : msg
        )
      );
    } catch (error) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                content: 'Sorry, I encountered an error. Please try again.',
                status: 'error' 
              } 
            : msg
        )
      );
    }
  }, [input, isLoading, streamMessage]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    // Auto-send after a brief delay
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  }, [isListening, startListening, stopListening]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-elevated border-l border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">AI Assistant</h3>
            <p className="text-xs text-text-muted">Powered by Gemini</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
          aria-label="Close AI Assistant"
        >
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-3 border-b border-border-default">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(prompt.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-overlay rounded-full text-sm text-text-secondary hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors whitespace-nowrap"
            >
              <prompt.icon className="w-3.5 h-3.5" />
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? "flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'user' 
                  ? "bg-primary-500" 
                  : "bg-gradient-to-br from-primary-500 to-accent-500"
              )}>
                {message.role === 'user' ? (
                  <span className="text-sm font-medium text-white">You</span>
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div className={cn(
                "flex-1 max-w-[85%]",
                message.role === 'user' ? "text-right" : ""
              )}>
                <div className={cn(
                  "inline-block px-4 py-3 rounded-2xl",
                  message.role === 'user'
                    ? "bg-primary-500 text-white rounded-br-md"
                    : "bg-surface-overlay text-text-primary rounded-bl-md"
                )}>
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Markdown>{message.content}</Markdown>
                      {message.status === 'streaming' && (
                        <span className="inline-block w-2 h-4 bg-primary-500 animate-pulse ml-1" />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>

                {/* Message Actions */}
                {message.role === 'assistant' && message.status === 'complete' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="p-1 rounded hover:bg-surface-overlay transition-colors"
                      title="Copy"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-success-light" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </button>
                    <button className="p-1 rounded hover:bg-surface-overlay transition-colors" title="Good response">
                      <ThumbsUp className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                    <button className="p-1 rounded hover:bg-surface-overlay transition-colors" title="Bad response">
                      <ThumbsDown className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                  </div>
                )}

                {/* AI Actions */}
                {message.metadata?.actions && message.metadata.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.metadata.actions.map((action, i) => (
                      <button
                        key={i}
                        className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border-default">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything about your SACCO..."
              className="w-full px-4 py-3 pr-12 bg-surface-overlay border border-border-default rounded-xl resize-none text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            {speechSupported && (
              <button
                onClick={toggleListening}
                className={cn(
                  "absolute right-2 bottom-2 p-2 rounded-lg transition-colors",
                  isListening 
                    ? "bg-red-500 text-white" 
                    : "hover:bg-surface-overlay text-text-muted"
                )}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-3 rounded-xl transition-all",
              input.trim() && !isLoading
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "bg-surface-overlay text-text-muted cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function parseActionsFromResponse(response: string): AIAction[] {
  // Parse action suggestions from AI response
  const actions: AIAction[] = [];
  
  // Look for action patterns like [ACTION: label](type:payload)
  const actionPattern = /\[ACTION:\s*([^\]]+)\]\(([^:]+):([^)]+)\)/g;
  let match;
  
  while ((match = actionPattern.exec(response)) !== null) {
    actions.push({
      label: match[1],
      type: match[2] as AIAction['type'],
      payload: match[3],
    });
  }
  
  return actions;
}
