"use client";

import { useEffect,useRef, useState } from "react";

import { useSupabase } from "@/components/providers/SupabaseProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentType?: "sales" | "marketing" | "support";
}

export function SupportChat() {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm here to help. Choose a department:\n\n🎯 Sales - Product inquiries and demos\n📢 Marketing - Campaigns and outreach\n💬 Support - Technical assistance\n\nYou can also just type your question and I'll route it to the right agent.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<"sales" | "marketing" | "support" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Determine agent type from input or selection
      let agentType = selectedAgent;
      if (!agentType) {
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes("sales") || lowerInput.includes("demo") || lowerInput.includes("pricing")) {
          agentType = "sales";
        } else if (lowerInput.includes("marketing") || lowerInput.includes("campaign")) {
          agentType = "marketing";
        } else {
          agentType = "support";
        }
      }

      // AI agent support is currently unavailable
      // TODO: Implement admin panel support via wa-webhook-core or dedicated admin support service
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "AI agent support is currently being updated. Please contact support directly at support@easymo.rw or use the contact form.",
        timestamp: new Date(),
        agentType,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Support chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again or contact support directly.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agentButtons = [
    { type: "sales" as const, label: "Sales", icon: "🎯" },
    { type: "marketing" as const, label: "Marketing", icon: "📢" },
    { type: "support" as const, label: "Support", icon: "💬" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] max-w-4xl mx-auto">
      {/* Agent Selection */}
      <div className="flex gap-2 mb-4">
        {agentButtons.map((agent) => (
          <button
            key={agent.type}
            onClick={() => setSelectedAgent(agent.type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedAgent === agent.type
                ? "bg-blue-600 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            <span>{agent.icon}</span>
            <span>{agent.label}</span>
          </button>
        ))}
        {selectedAgent && (
          <button
            onClick={() => setSelectedAgent(null)}
            className="px-3 py-2 text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.agentType && message.role === "assistant" && (
                  <div className="text-xs opacity-75 mb-1">
                    {message.agentType.charAt(0).toUpperCase() + message.agentType.slice(1)} Agent
                  </div>
                )}
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-75 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            selectedAgent
              ? `Ask the ${selectedAgent} agent...`
              : "Type your message or select an agent above..."
          }
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
