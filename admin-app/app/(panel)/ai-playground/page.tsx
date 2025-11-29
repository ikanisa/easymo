import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoiceAgent } from '@/components/ai/VoiceAgent';
import { RealtimeChat } from '@/components/ai/RealtimeChat';
import { ImageGenerator } from '@/components/ai/ImageGenerator';
import { AgentToolConfig } from '@/components/agents/AgentToolConfig';
import { AgentTestBench } from '@/components/agents/AgentTestBench';

export const metadata: Metadata = {
  title: 'AI Agent Playground | EasyMO',
  description: 'Test and interact with AI agents using voice, chat, and image generation'
};

export default function AIPlaygroundPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Agent Playground</h1>
        <p className="text-muted-foreground">
          Comprehensive testing environment for AI agents with voice, realtime chat, image generation, and tool configuration.
        </p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="chat">Realtime Chat</TabsTrigger>
          <TabsTrigger value="voice">Voice Agent</TabsTrigger>
          <TabsTrigger value="images">Image Generator</TabsTrigger>
          <TabsTrigger value="tools">Tool Config</TabsTrigger>
          <TabsTrigger value="tests">Test Bench</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <div className="h-[700px]">
            <RealtimeChat
              agentId="demo-agent"
              onMessageSent={(msg) => console.log('Message sent:', msg)}
              onResponseReceived={(res) => console.log('Response:', res)}
            />
          </div>
        </TabsContent>

        <TabsContent value="voice" className="mt-6">
          <VoiceAgent
            agentId="demo-agent"
            provider="openai"
            onTranscript={(text, role) => console.log(`[${role}]:`, text)}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
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
          <AgentTestBench
            agentId="demo-agent"
            agentName="Demo Agent"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
