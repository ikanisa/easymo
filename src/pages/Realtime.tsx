import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Waves,
  PhoneCall,
  Globe,
  Cable,
  Satellite,
  KeyRound,
  Braces,
  ArrowRightLeft,
  RadioTower,
  LayoutList,
  Wrench,
  ExternalLink,
} from "lucide-react";
import { Server, ShieldCheck, Workflow, MicVocal } from "lucide-react";
import { Clock, Activity, FileAudio2, Database } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback } from "react";

interface ConnectionMethod {
  name: string;
  description: string;
  details: string[];
  icon: LucideIcon;
}

interface UsageGuide {
  title: string;
  description: string;
  link: string;
}

interface MigrationChange {
  title: string;
  items: string[];
  icon: LucideIcon;
}

interface LifecycleStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

const connectionMethods: ConnectionMethod[] = [
  {
    name: "WebRTC",
    description: "Best for browser-based voice and multimodal experiences.",
    details: [
      "Uses the Realtime Agents SDK to orchestrate audio IO and state sync.",
      "Handles microphone capture, playback, and low-latency data channels.",
      "Ephemeral client secrets keep browser environments secure.",
    ],
    icon: PhoneCall,
  },
  {
    name: "WebSocket",
    description: "Great for middle-tier services that stream audio or text.",
    details: [
      "Single persistent connection for bi-directional events.",
      "Ideal when you need to coordinate tools or custom routing on the server.",
      "Share sessions with downstream services for analytics or guardrails.",
    ],
    icon: Cable,
  },
  {
    name: "SIP",
    description: "Connects traditional telephony to Realtime agents.",
    details: [
      "Bridge existing VoIP carriers or call centers into OpenAI Realtime.",
      "Useful for warm transfers between AI agents and humans.",
      "Deploy alongside SIP registrars or Twilio Elastic SIP trunks.",
    ],
    icon: Satellite,
  },
];

const usageGuides: UsageGuide[] = [
  {
    title: "Prompting guide",
    description: "Best practices for steering realtime conversations and tool calls.",
    link: "https://platform.openai.com/docs/guides/realtime/prompting",
  },
  {
    title: "Managing conversations",
    description: "Understand session lifecycle events, from creation to teardown.",
    link: "https://platform.openai.com/docs/guides/realtime/manage-conversations",
  },
  {
    title: "Webhooks & server control",
    description: "Fan out events, call tools, and orchestrate guardrails from your backend.",
    link: "https://platform.openai.com/docs/guides/realtime/server-events",
  },
  {
    title: "Realtime transcription",
    description: "Stream audio input for instant speech-to-text experiences.",
    link: "https://platform.openai.com/docs/guides/realtime/transcription",
  },
];

const migrationChanges: MigrationChange[] = [
  {
    title: "Unified client secrets",
    icon: KeyRound,
    items: [
      "Generate browser-safe tokens with POST /v1/realtime/client_secrets.",
      "Session payload controls model, modality, and audio voice settings.",
    ],
  },
  {
    title: "WebRTC answer endpoint",
    icon: RadioTower,
    items: [
      "Use /v1/realtime/calls to exchange SDP offers for GA sessions.",
      "Pass the ephemeral key in the Authorization header when fetching the answer.",
    ],
  },
  {
    title: "Session schema updates",
    icon: LayoutList,
    items: [
      "Specify session.type for realtime or transcription workloads.",
      "Audio output configuration now lives under session.audio.output.",
    ],
  },
  {
    title: "Event name alignment",
    icon: ArrowRightLeft,
    items: [
      "response.text.delta → response.output_text.delta",
      "response.audio.delta → response.output_audio.delta",
      "response.audio_transcript.delta → response.output_audio_transcript.delta",
    ],
  },
  {
    title: "Conversation item lifecycle",
    icon: Wrench,
    items: [
      "conversation.item.added and conversation.item.done complement .created.",
      "All GA items include object=realtime.item for consistent parsing.",
    ],
  },
];

const websocketQuickstart = `import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
  headers: { Authorization: \`Bearer ${'${process.env.OPENAI_API_KEY}'}\` },
});

ws.on("open", () => {
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: "Be extra nice today!",
      },
    })
  );
});`;

const sipHighlights = [
  "Provision SIP trunks that can route calls to OpenAI's SIP edge.",
  "Authenticate with SIP digest credentials generated per tenant.",
  "Forward DTMF digits as session metadata for agent hand-offs.",
];

const guardrailPractices = [
  "Maintain an allowlist of tools the realtime session can call.",
  "Handle response.output_audio_transcript.delta to moderate speech in-flight.",
  "Mirror events into your analytics pipeline for live QA dashboards.",
];

const migrationCallouts = [
  "Function call outputs now support an optional status field (parity with Responses API).",
  "Assistant messages adopt type=output_text and type=output_audio for schema consistency.",
  "Every GA item surfaces object=realtime.item so you can fan-in session logs easily.",
];

const sessionLifecycle: LifecycleStep[] = [
  {
    title: "Create the session",
    description: "POST /v1/realtime/client_secrets with your target model and modality requirements.",
    icon: Activity,
  },
  {
    title: "Establish transport",
    description: "Negotiate WebRTC, WebSocket, or SIP and emit session.update once the connection opens.",
    icon: Cable,
  },
  {
    title: "Stream inputs",
    description: "Send audio buffers, tool results, or text prompts incrementally for sub-second latency.",
    icon: Waves,
  },
  {
    title: "Monitor outputs",
    description: "Consume response.output_* events to drive speech synthesis, transcripts, and UI state.",
    icon: Clock,
  },
  {
    title: "Close gracefully",
    description: "Send session.close or drop the transport cleanly to release ephemeral credentials early.",
    icon: Server,
  },
];

const transcriptionQuickstart = `import WebSocket from "ws";

const ws = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-mini-transcribe", {
  headers: { Authorization: \`Bearer ${'${process.env.OPENAI_API_KEY}'}\` },
});

ws.on("open", () => {
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: { type: "transcription", input_audio_format: "pcm16" },
    })
  );
});

ws.on("message", (event) => {
  const data = JSON.parse(event.toString());
  if (data.type === "response.output_audio_transcript.delta") {
    process.stdout.write(data.delta);
  }
});`;

const telemetryCheckpoints = [
  "Emit structured logs when session.update mutates guardrail configuration.",
  "Persist summarized transcripts per conversation for downstream analytics.",
  "Alert on elevated server.latency_ms metrics to catch degraded carrier routes early.",
];

export default function Realtime() {
  const openDocs = useCallback(() => {
    window.open("https://platform.openai.com/docs/guides/realtime", "_blank", "noopener,noreferrer");
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Realtime API"
          description="Build low-latency multimodal agents with OpenAI's realtime stack."
          action={{
            label: "Realtime docs",
            onClick: openDocs,
            icon: ExternalLink,
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Waves className="h-5 w-5" />
              <span>Why Realtime</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The Realtime API powers end-to-end speech and multimodal interactions. Pair it with the Agents SDK
              for WebRTC voice agents, or connect directly via WebSocket and SIP when you need to run server-side
              coordination or telephony bridges.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Voice agents</Badge>
              <Badge variant="secondary">Low latency</Badge>
              <Badge variant="secondary">Multimodal IO</Badge>
              <Badge variant="secondary">Tool calling</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PhoneCall className="h-5 w-5" />
                <span>Voice Agent Quickstart</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Start with the Agents SDK to spin up a browser voice agent. It manages microphone access, audio output,
                and session orchestration so you can focus on your agent instructions and tools.
              </p>
              <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">
{`import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const agent = new RealtimeAgent({
  name: "Assistant",
  instructions: "You are a helpful assistant.",
});

const session = new RealtimeSession(agent);
await session.connect({ apiKey: "<client-api-key>" });`}
              </pre>
              <p className="text-sm text-muted-foreground">
                Deploy the session in the browser for instant speech-to-speech. On the server, the same SDK can fall
                back to WebSocket transport when WebRTC is unavailable.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>WebSocket bootstrap</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Establish a persistent duplex channel from your application server to stream prompts, audio, and
                tool responses without negotiating WebRTC.
              </p>
              <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">{websocketQuickstart}</pre>
              <p className="text-xs text-muted-foreground">
                Use session.update events to toggle modalities and instructions in-flight—no need to recreate the
                connection for lightweight changes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Connection methods</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.name} className="rounded-lg border bg-card/50 p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <h3 className="text-sm font-semibold">{method.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {method.details.map((detail) => (
                        <li key={detail}>• {detail}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Braces className="h-5 w-5" />
                <span>Generate client secrets</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use the unified client secret endpoint to provision temporary tokens for browser or mobile clients.
                They scope access to a single session and expire automatically.
              </p>
              <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">
{`const sessionConfig = {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: { output: { voice: "marin" } },
  },
};

const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
  method: "POST",
  headers: {
    Authorization: \`Bearer ${'${apiKey}'}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(sessionConfig),
});

const { value } = await response.json();
console.log(value);`}
              </pre>
              <p className="text-xs text-muted-foreground">
                The returned value (ek_...) is safe to hand to browser sessions and should be rotated frequently.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MicVocal className="h-5 w-5" />
                <span>SIP & telephony bridges</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Bring your contact center into the loop with SIP trunks that terminate directly on the realtime edge.
                Pair IVR flows with tool-calling for intelligent hand-offs.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {sipHighlights.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Session lifecycle playbook</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Align your backend and client teams on the handshakes that keep realtime sessions resilient across
                transports and deployment environments.
              </p>
              <ol className="space-y-3">
                {sessionLifecycle.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex items-start space-x-3 rounded-lg border bg-card/50 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">{step.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Realtime API usage guides</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {usageGuides.map((guide) => (
              <div key={guide.title} className="rounded-lg border bg-card/50 p-4 space-y-2">
                <h3 className="text-sm font-semibold">{guide.title}</h3>
                <p className="text-sm text-muted-foreground">{guide.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => window.open(guide.link, "_blank", "noopener,noreferrer")}
                >
                  Learn more
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileAudio2 className="h-5 w-5" />
              <span>Realtime transcription quickstart</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stream microphone frames or telephony tap audio to transcribe conversations as they unfold. Pair
              transcripts with your CRM to unlock intelligent routing and redaction pipelines.
            </p>
            <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">{transcriptionQuickstart}</pre>
            <p className="text-xs text-muted-foreground">
              Respond to response.output_audio_transcript.delta events to surface live captions or to trigger keyword
              detection flows without waiting for the session to finish.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Beta → GA migration checklist</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {migrationChanges.map((change) => {
              const Icon = change.icon;
              return (
                <div key={change.title} className="rounded-lg border bg-card/50 p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">{change.title}</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {change.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5" />
              <span>Guardrails & observability</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keep human-in-the-loop and safety systems ahead of the conversation by subscribing to session events in
              realtime. These practices keep your compliance and analytics partners aligned.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {guardrailPractices.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Operational telemetry checkpoints</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Close the loop between your realtime agents and production SRE dashboards with structured monitoring.
              These checkpoints keep deployments healthy at scale.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {telemetryCheckpoints.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Workflow className="h-5 w-5" />
              <span>Additional GA callouts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Beyond the checklist above, a few structural updates landed with the GA release that are easy to miss if you
              were running the beta stack.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {migrationCallouts.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

