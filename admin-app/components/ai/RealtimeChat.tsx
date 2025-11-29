'use client';

import { Loader2, Send, Sparkles,StopCircle } from 'lucide-react';
import { useEffect,useRef, useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  functionCalls?: FunctionCall[];
}

interface FunctionCall {
  name: string;
  arguments: any;
  result?: any;
}

interface RealtimeChatProps {
  agentId?: string;
  sessionId?: string;
  initialMessages?: Message[];
  onMessageSent?: (message: string) => void;
  onResponseReceived?: (response: string) => void;
}

export function RealtimeChat({
  agentId,
  sessionId,
  initialMessages = [],
  onMessageSent,
  onResponseReceived
}: RealtimeChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [model, setModel] = useState('gpt-4o-realtime-preview');

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, [provider, agentId, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      provider,
      ...(agentId && { agentId }),
      ...(sessionId && { sessionId }),
      model
    });
    
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ai/realtime?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleRealtimeEvent(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };
  };

  const handleRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'response.text.delta':
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + event.delta }
            ];
          }
          return prev;
        });
        break;

      case 'response.text.done':
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, streaming: false }
            ];
          }
          return prev;
        });
        setIsStreaming(false);
        if (event.text) {
          onResponseReceived?.(event.text);
        }
        break;

      case 'response.function_call_arguments.delta':
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.functionCalls) {
            const lastCall = lastMsg.functionCalls[lastMsg.functionCalls.length - 1];
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                functionCalls: [
                  ...lastMsg.functionCalls.slice(0, -1),
                  {
                    ...lastCall,
                    arguments: lastCall.arguments + event.delta
                  }
                ]
              }
            ];
          }
          return prev;
        });
        break;

      case 'error':
        console.error('Realtime error:', event.error);
        setIsStreaming(false);
        break;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !isConnected) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    onMessageSent?.(input.trim());

    // Create streaming assistant message
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);
    setInput('');

    // Send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: input.trim() }]
        }
      }));

      wsRef.current.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text'],
          temperature: 0.7
        }
      }));
    }
  };

  const stopStreaming = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'response.cancel'
      }));
    }
    setIsStreaming(false);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Realtime Chat</h3>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>

          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider === 'openai' ? (
                <>
                  <SelectItem value="gpt-4o-realtime-preview">GPT-4o Realtime</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Start a conversation with your AI agent</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`flex flex-col max-w-[70%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {message.functionCalls && message.functionCalls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        {message.functionCalls.map((call, idx) => (
                          <div key={idx} className="text-xs opacity-80">
                            <span className="font-medium">🔧 {call.name}</span>
                            {call.result && (
                              <span className="ml-2">→ {JSON.stringify(call.result)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.streaming && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className="h-1 w-1 rounded-full bg-current animate-pulse" />
                        <div className="h-1 w-1 rounded-full bg-current animate-pulse delay-75" />
                        <div className="h-1 w-1 rounded-full bg-current animate-pulse delay-150" />
                      </div>
                    )}
                  </div>
                  
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>

                {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-xs">
                      YOU
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? "Type your message..." : "Connecting..."}
            disabled={!isConnected || isStreaming}
            className="flex-1"
          />
          
          {isStreaming ? (
            <Button type="button" onClick={stopStreaming} variant="destructive">
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={!isConnected || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </Card>
  );
}
