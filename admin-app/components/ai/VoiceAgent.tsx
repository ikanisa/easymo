'use client';

import { Loader2, Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect,useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

type VoiceProvider = 'openai' | 'gemini';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface VoiceAgentProps {
  agentId?: string;
  provider?: VoiceProvider;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

export function VoiceAgent({ agentId, provider = 'openai', onTranscript }: VoiceAgentProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentProvider, setCurrentProvider] = useState<VoiceProvider>(provider);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const connect = async () => {
    try {
      setConnectionState('connecting');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ai/voice?provider=${currentProvider}${agentId ? `&agentId=${agentId}` : ''}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        // Send initial configuration
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }));

        // Start audio streaming
        startAudioStreaming(ws, stream);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleVoiceEvent(data);
      };

      ws.onerror = () => {
        setConnectionState('error');
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        cleanup();
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      setConnectionState('error');
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    cleanup();
  };

  const cleanup = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
  };

  const startAudioStreaming = (ws: WebSocket, stream: MediaStream) => {
    const audioContext = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      if (isMuted || ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: arrayBufferToBase64(pcm16.buffer)
      }));
    };
  };

  const handleVoiceEvent = (event: any) => {
    switch (event.type) {
      case 'conversation.item.created':
        if (event.item.type === 'message') {
          const message: VoiceMessage = {
            id: event.item.id,
            role: event.item.role,
            content: event.item.content?.[0]?.transcript || '',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, message]);
          onTranscript?.(message.content, message.role);
        }
        break;

      case 'response.audio.delta':
        if (!isSpeakerMuted && event.delta) {
          playAudioChunk(event.delta);
        }
        break;

      case 'response.text.delta':
        // Update last assistant message
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + event.delta }
            ];
          }
          return prev;
        });
        break;

      case 'error':
        console.error('Voice error:', event.error);
        break;
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    const audioData = base64ToArrayBuffer(base64Audio);
    const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Voice Agent</h3>
          <Badge variant={connectionState === 'connected' ? 'default' : 'secondary'}>
            {connectionState}
          </Badge>
        </div>
        
        <Select value={currentProvider} onValueChange={(v) => setCurrentProvider(v as VoiceProvider)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="gemini">Gemini Live</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-64 rounded border p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Start a conversation by connecting and speaking
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-center gap-4">
        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <Button
            onClick={connect}
            size="lg"
            className="gap-2"
          >
            {connectionState === 'error' ? 'Retry Connection' : 'Start Voice Chat'}
            <Mic className="h-4 w-4" />
          </Button>
        ) : connectionState === 'connecting' ? (
          <Button size="lg" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : (
          <>
            <Button
              variant={isMuted ? 'destructive' : 'default'}
              size="lg"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={isSpeakerMuted ? 'outline' : 'default'}
              size="lg"
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
            >
              {isSpeakerMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={disconnect}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
