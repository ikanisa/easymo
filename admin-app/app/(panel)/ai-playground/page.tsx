import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  MessageSquare, 
  Mic, 
  Image as ImageIcon,
  Settings,
  Wrench,
  FlaskConical,
  Activity
} from 'lucide-react';
import { VoiceAgent } from '@/components/ai/VoiceAgent';
import { RealtimeChat } from '@/components/ai/RealtimeChat';
import { ImageGenerator } from '@/components/ai/ImageGenerator';
import { AgentToolConfig } from '@/components/agents/AgentToolConfig';
import { AgentTestBench } from '@/components/agents/AgentTestBench';
import { ChatCompletionsPlayground } from '@/components/ai/ChatCompletionsPlayground';

export const metadata: Metadata = {
  title: 'AI Agent Playground | EasyMO',
  description: 'Test and interact with AI agents using voice, chat, and image generation'
};

export default function AIPlaygroundPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Agent Playground
          </h1>
          <p className="text-muted-foreground">
            Comprehensive testing environment for AI agents with voice, realtime chat, image generation, and tool configuration.
          </p>
        </div>

        {/* Status Badges */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Status:</span>
            </div>
            <Badge variant="default" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              OpenAI
            </Badge>
            <Badge variant="default" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Gemini
            </Badge>
            <Badge variant="outline" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              Imagen
            </Badge>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="completions" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="completions" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat API
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Realtime
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="tests" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completions" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Chat Completions API</h2>
                <p className="text-sm text-muted-foreground">
                  Test OpenAI chat models with custom prompts and parameters
                </p>
              </div>
              <Badge variant="outline">OpenAI API</Badge>
            </div>
            <ChatCompletionsPlayground />
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 lg:col-span-1">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                About Realtime Chat
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Stream responses in real-time using WebSocket connections. Supports both OpenAI and Gemini models.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-medium">~50ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Streaming:</span>
                  <Badge variant="default" className="text-xs">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tools:</span>
                  <Badge variant="secondary" className="text-xs">Function Calls</Badge>
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2 h-[700px]">
              <RealtimeChat
                agentId="demo-agent"
                onMessageSent={(msg) => console.log('Message sent:', msg)}
                onResponseReceived={(res) => console.log('Response:', res)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="voice" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 lg:col-span-1">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                About Voice Agent
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Real-time voice conversations with AI agents using OpenAI Realtime API or Gemini Live.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-medium text-sm mb-1">Features</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Voice Activity Detection (VAD)</li>
                    <li>• Real-time transcription</li>
                    <li>• Low latency (~300ms)</li>
                    <li>• Natural conversation flow</li>
                  </ul>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-medium text-sm mb-1">Use Cases</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Customer support</li>
                    <li>• Driver assistance</li>
                    <li>• Order taking</li>
                    <li>• Information queries</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2">
              <VoiceAgent
                agentId="demo-agent"
                provider="openai"
                onTranscript={(text, role) => console.log(`[${role}]:`, text)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Image Generation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Generate images using DALL·E 3, DALL·E 2, or Google Imagen 3 for product photos, marketing banners, and creative content.
            </p>
          </Card>
          <ImageGenerator
            onImageGenerated={(img) => console.log('Image generated:', img)}
          />
        </TabsContent>

        <TabsContent value="tools" className="mt-6">
          <AgentToolConfig
            agentId="demo-agent"
            onToolsUpdated={(tools) => console.log('Tools updated:', tools)}
          />
        </TabsContent>

        <TabsContent value="tests" className="mt-6">
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Agent Test Bench</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Run automated tests to validate agent behavior, responses, and tool usage.
            </p>
          </Card>
          <AgentTestBench
            agentId="demo-agent"
            agentName="Demo Agent"
          />
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium mb-1">Configuration</p>
            <p className="text-muted-foreground text-xs">
              API keys are configured via Supabase Secrets (OPENAI_API_KEY, GOOGLE_AI_API_KEY, GOOGLE_MAPS_API_KEY).
              Models and providers can be changed in real-time. All AI interactions are logged for monitoring and analytics.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
