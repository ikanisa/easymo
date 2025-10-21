import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ADAPTER } from "@/lib/adapter";
import type {
  AgentChatMessage,
  AgentChatPayload,
  AgentChatResponse,
  AgentChatSession,
} from "@/lib/types";
import type { AgentKind } from "@easymo/commons";
import { ExternalLink, Loader2, MessageSquare } from "lucide-react";

type AgentChatPanelProps = {
  agentKind: AgentKind;
  title: string;
  description: string;
  featureEnabled: boolean;
  allowProfileRef?: boolean;
};

const isTruthy = (value?: string | null) =>
  typeof value === "string" && value.trim().length > 0;

const normaliseMessages = (messages: AgentChatMessage[] = []) =>
  [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

const mergeMessages = (
  current: AgentChatMessage[],
  incoming: AgentChatMessage[],
) => {
  const map = new Map<string, AgentChatMessage>();
  for (const msg of current) {
    map.set(msg.id, msg);
  }
  for (const msg of incoming) {
    map.set(msg.id, msg);
  }
  return normaliseMessages(Array.from(map.values()));
};

export default function AgentChatPanel({
  agentKind,
  title,
  description,
  featureEnabled,
  allowProfileRef = true,
}: AgentChatPanelProps) {
  const { toast } = useToast();
  const [session, setSession] = useState<AgentChatSession | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [profileRef, setProfileRef] = useState("");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => `agent_chat_${agentKind}`, [agentKind]);

  const storeConversation = useCallback(
    (nextSession: AgentChatSession | null, nextMessages: AgentChatMessage[]) => {
      if (!featureEnabled) return;
      if (!nextSession) {
        localStorage.removeItem(storageKey);
        return;
      }
      const payload = {
        session: nextSession,
        messages: nextMessages.slice(-100),
        profileRef,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    [featureEnabled, storageKey, profileRef],
  );

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchHistory = useCallback(
    async (sessionId: string) => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const response = await ADAPTER.getAgentSession(sessionId);
        if (!response) {
          setSession(null);
          setMessages([]);
          storeConversation(null, []);
          return;
        }
        setSession(response.session);
        setMessages(normaliseMessages(response.messages ?? []));
        setSuggestions(response.suggestions ?? []);
        storeConversation(response.session, response.messages ?? []);
      } catch (error) {
        console.error("agent-chat.history_failed", error);
        const message = error instanceof Error
          ? error.message
          : "Unable to load chat history.";
        setHistoryError(message);
      } finally {
        setLoadingHistory(false);
      }
    },
    [storeConversation],
  );

  useEffect(() => {
    if (!featureEnabled) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        session?: AgentChatSession;
        messages?: AgentChatMessage[];
        profileRef?: string;
      };
      if (parsed.profileRef) {
        setProfileRef(parsed.profileRef);
      }
      if (parsed.session) {
        setSession(parsed.session);
        setMessages(normaliseMessages(parsed.messages ?? []));
        fetchHistory(parsed.session.id);
      }
    } catch (error) {
      console.warn("agent-chat.restore_failed", error);
    }
  }, [featureEnabled, storageKey, fetchHistory]);

  const mutation = useMutation({
    mutationFn: async (body: { message: string }) => {
      const payload = {
        agentKind,
        message: body.message,
        sessionId: session?.id,
        profileRef: isTruthy(profileRef) ? profileRef.trim() : undefined,
      };
      const response = await ADAPTER.sendAgentMessage(payload);
      console.warn("agent_chat_event", {
        agent: agentKind,
        type: "message_sent",
        session_id: response.session?.id,
      });
      return response;
    },
    onSuccess: (response: AgentChatResponse) => {
      setSession(response.session);
      setMessages((prev) => mergeMessages(prev, response.messages ?? []));
      setSuggestions(response.suggestions ?? []);
      setInput("");
      storeConversation(response.session, response.messages ?? []);
    },
    onError: (error: unknown) => {
      console.error("agent_chat_event_failed", error);
      const message = error instanceof Error ? error.message : "Request failed";
      toast({
        title: "Chat unavailable",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || mutation.isPending || loadingHistory) return;
    mutation.mutate({ message: input.trim() });
  };

  const renderMetadata = (payload?: Record<string, unknown>) => {
    if (!payload) return null;

    const blocks: JSX.Element[] = [];
    if (payload.toolkit && typeof payload.toolkit === "object") {
      const toolkit = payload.toolkit as Record<string, unknown>;
      const summary: Array<{ label: string; value: string }> = [];
      if (typeof toolkit.model === "string") {
        summary.push({ label: "Model", value: toolkit.model });
      }
      if (typeof toolkit.reasoning_effort === "string") {
        summary.push({ label: "Reasoning", value: toolkit.reasoning_effort });
      }
      if (typeof toolkit.text_verbosity === "string") {
        summary.push({ label: "Verbosity", value: toolkit.text_verbosity });
      }
      const metadata = toolkit.metadata && typeof toolkit.metadata === "object"
        ? (toolkit.metadata as Record<string, unknown>)
        : null;
      const systemPrompt = metadata && typeof metadata.system_prompt === "string"
        ? metadata.system_prompt
        : "";
      const instructionList = metadata && Array.isArray(metadata.instructions)
        ? metadata.instructions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

      blocks.push(
        <div key="toolkit" className="space-y-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Toolkit configuration</p>
          {summary.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {summary.map((row) => (
                <div key={row.label} className="rounded border bg-muted/40 px-2 py-1">
                  <p className="text-[9px] uppercase text-muted-foreground">{row.label}</p>
                  <p className="font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          )}
          {systemPrompt && (
            <div className="rounded border bg-muted/30 p-2 text-[11px]">
              <p className="text-[9px] uppercase text-muted-foreground">System prompt override</p>
              <p>{systemPrompt}</p>
            </div>
          )}
          {instructionList.length > 0 && (
            <div className="rounded border bg-muted/30 p-2 text-[11px] space-y-1">
              <p className="text-[9px] uppercase text-muted-foreground">Additional instructions</p>
              <ul className="list-disc pl-4 space-y-1">
                {instructionList.map((instruction, idx) => (
                  <li key={`instruction-${idx}`}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}
        </div>,
      );
    }
    const citations = Array.isArray(payload.citations) ? payload.citations : [];
    if (citations.length > 0) {
      blocks.push(
        <div key="citations" className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Citations</p>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            {citations.map((item, idx) => {
              const citation = item as Record<string, unknown>;
              if (citation?.type === "url_citation" && typeof citation.url === "string") {
                return (
                  <li key={`citation-${idx}`}>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted"
                    >
                      {typeof citation.title === "string" && citation.title.trim().length > 0
                        ? citation.title
                        : citation.url}
                    </a>
                  </li>
                );
              }
              if (citation?.type === "file_citation" && typeof citation.filename === "string") {
                return (
                  <li key={`citation-${idx}`}>
                    File: {citation.filename}
                  </li>
                );
              }
              return (
                <li key={`citation-${idx}`} className="text-[10px]">
                  {JSON.stringify(citation)}
                </li>
              );
            })}
          </ul>
        </div>,
      );
    }

    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    if (sources.length > 0) {
      blocks.push(
        <div key="sources" className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sources consulted</p>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            {sources.map((source, idx) => {
              const item = source as Record<string, unknown>;
              if (typeof item.url === "string") {
                return (
                  <li key={`source-${idx}`}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted"
                    >
                      {typeof item.title === "string" && item.title.trim().length > 0
                        ? item.title
                        : item.url}
                    </a>
                  </li>
                );
              }
              return (
                <li key={`source-${idx}`} className="text-[10px]">
                  {JSON.stringify(item)}
                </li>
              );
            })}
          </ul>
        </div>,
      );
    }

    const images = Array.isArray(payload.images) ? payload.images : [];
    if (images.length > 0) {
      blocks.push(
        <div key="images" className="space-y-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Generated imagery</p>
          <div className="flex flex-wrap gap-3">
            {images.map((raw, idx) => {
              const image = raw as Record<string, unknown>;
              const data = typeof image.data === "string" ? image.data : "";
              if (!data) return null;
              const format = typeof image.format === "string" ? image.format : "png";
              const src = data.startsWith("data:") ? data : `data:image/${format};base64,${data}`;
              const alt = typeof image.revised_prompt === "string"
                ? image.revised_prompt
                : `Generated asset ${idx + 1}`;
              return (
                <img
                  key={`image-${idx}`}
                  src={src}
                  alt={alt}
                  className="max-h-32 rounded border"
                />
              );
            })}
          </div>
        </div>,
      );
    }

    const toolCalls = Array.isArray(payload.tool_calls) ? payload.tool_calls : [];
    if (toolCalls.length > 0) {
      blocks.push(
        <div key="tool-calls" className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Tool activity</p>
          <pre className="max-h-48 overflow-x-auto whitespace-pre-wrap rounded border bg-muted/60 p-2 text-[10px]">
            {JSON.stringify(toolCalls, null, 2)}
          </pre>
        </div>,
      );
    }

    if (typeof payload.retrieval_context === "string" && payload.retrieval_context.trim().length > 0) {
      blocks.push(
        <div key="retrieval" className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Retrieval context</p>
          <pre className="max-h-48 overflow-x-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 text-[10px]">
            {payload.retrieval_context}
          </pre>
        </div>,
      );
    }

    if (payload.stub) {
      blocks.push(
        <div key="stub" className="text-[10px] uppercase text-muted-foreground">
          Stubbed response
        </div>,
      );
    }

    if (blocks.length === 0) return null;
    return <div className="mt-2 space-y-3">{blocks}</div>;
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const renderBody = () => {
    if (!featureEnabled) {
      return (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Agent chat is disabled. Set <code>VITE_ENABLE_AGENT_CHAT=1</code> (admin UI)
            and <code>ENABLE_AGENT_CHAT=1</code> (Supabase Edge) to enable this preview.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {allowProfileRef && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`${agentKind}-profile`}>
              Profile / Ref Code (optional)
            </label>
            <Input
              id={`${agentKind}-profile`}
              placeholder="e.g. 123456"
              value={profileRef}
              onChange={(event) => setProfileRef(event.target.value.toUpperCase())}
            />
          </div>
        )}
        <ScrollArea className="h-64 pr-4 border rounded-md bg-muted/30">
          <div className="space-y-3 p-4 text-sm">
            {loadingHistory && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading previous messages…
              </div>
            )}
            {historyError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
                {historyError}
              </div>
            )}
            {messages.length === 0 && !loadingHistory ? (
              <div className="text-muted-foreground text-xs">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const payload = (msg.payload ?? {}) as AgentChatPayload;
                const citations = Array.isArray(payload.citations) ? payload.citations : [];
                const usedSearch = Array.isArray(payload.web_search_calls) && payload.web_search_calls.length > 0;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`rounded-lg px-3 py-2 max-w-[90%] space-y-2 ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-white text-foreground border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                        {!isUser && usedSearch && (
                          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wide">
                            Web search
                          </Badge>
                        )}
                      </div>
                      {!isUser && citations.length > 0 && (
                        <ol className="space-y-1 text-xs text-muted-foreground">
                          {citations.map((citation, index) => (
                            <li key={citation.id ?? `${msg.id}-citation-${index}`} className="flex items-start gap-1">
                              <span className="font-semibold">{index + 1}.</span>
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <span>{citation.title ?? citation.url}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>{title}</span>
            <Badge variant="outline">Preview</Badge>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
      {featureEnabled && (
        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full flex-col space-y-3">
            <Textarea
              placeholder="Type a message (Shift + Enter for newline)…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              disabled={mutation.isPending || loadingHistory}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Conversations persist locally until cleared.
              </span>
              <div className="flex items-center space-x-2">
                {session && (
                  <Badge variant="secondary" className="text-xs">
                    Session: {session.id.slice(0, 8)}
                  </Badge>
                )}
                <Button
                  type="submit"
                  disabled={mutation.isPending || loadingHistory || !input.trim()}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardFooter>
      )}
    </Card>
  );
}
