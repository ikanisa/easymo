"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAtlasAssistant } from "@/providers/atlas-assistant-provider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function ChatPanel() {
  const { context } = useAtlasAssistant();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your AI support assistant for the Ibimina SACCO platform. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const enrichedMessage = (() => {
        if (!context) {
          return userMessage.content;
        }
        const metadataEntries = context.metadata
          ? Object.entries(context.metadata)
              .filter(([, value]) => value !== null && value !== undefined && value !== "")
              .map(([key, value]) => `${key}: ${value}`)
          : [];
        const contextLines = [context.title];
        if (context.subtitle) {
          contextLines.push(context.subtitle);
        }
        if (metadataEntries.length > 0) {
          contextLines.push(...metadataEntries);
        }
        return `Context\n${contextLines.join("\n")}\n\n${userMessage.content}`;
      })();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: enrichedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          (typeof data === "object" && data !== null && "message" in data
            ? (data as { message?: string }).message
            : null) || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, there was an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-white/5">
      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {context && (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-xs text-white/80">
            <p className="text-sm font-semibold text-white">{context.title}</p>
            {context.subtitle && <p className="mt-1 text-white/70">{context.subtitle}</p>}
            {context.metadata && (
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(context.metadata)
                  .filter(([, value]) => value !== null && value !== undefined && value !== "")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                        {key}
                      </dt>
                      <dd className="text-sm text-white/80">{String(value)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-100"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={`mt-1 text-xs ${
                  message.role === "user" ? "text-blue-200" : "text-gray-400"
                }`}
              >
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-white/10 px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
