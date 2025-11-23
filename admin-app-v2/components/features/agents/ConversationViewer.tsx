"use client";

import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/ui/SearchBar";
import { useState } from "react";
import { MessageCircle, User, Bot, Clock } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  userName: string;
  agentName: string;
  status: "active" | "resolved" | "waiting";
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    userName: "Alice Johnson",
    agentName: "Sales Assistant",
    status: "active",
    lastMessage: "I need help with my order",
    lastMessageTime: "2m ago",
    unreadCount: 2,
    messages: [
      {
        id: "1",
        sender: "user",
        content: "Hello, I need help with my order",
        timestamp: "14:30",
      },
      {
        id: "2",
        sender: "agent",
        content: "Hi Alice! I'd be happy to help. Can you provide your order number?",
        timestamp: "14:31",
      },
      {
        id: "3",
        sender: "user",
        content: "It's ORDER-12345",
        timestamp: "14:32",
      },
    ],
  },
  {
    id: "2",
    userName: "Bob Smith",
    agentName: "Support Bot",
    status: "waiting",
    lastMessage: "Thanks for your help!",
    lastMessageTime: "15m ago",
    unreadCount: 0,
    messages: [
      {
        id: "1",
        sender: "user",
        content: "How do I reset my password?",
        timestamp: "14:15",
      },
      {
        id: "2",
        sender: "agent",
        content: "I can help you with that. Please click on the 'Forgot Password' link on the login page.",
        timestamp: "14:16",
      },
      {
        id: "3",
        sender: "user",
        content: "Thanks for your help!",
        timestamp: "14:17",
      },
    ],
  },
];

export function ConversationViewer() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(
    conversations[0]
  );
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Conversation List */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Live Conversations
          </h3>
          <SearchBar
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="space-y-2 mt-4">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedConversation?.id === conversation.id
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar fallback={conversation.userName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {conversation.userName}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {conversation.lastMessage}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <span className="text-xs text-gray-500">
                    {conversation.lastMessageTime}
                  </span>
                  <Badge
                    variant={
                      conversation.status === "active"
                        ? "success"
                        : conversation.status === "waiting"
                        ? "warning"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {conversation.status}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Conversation Detail */}
      <Card className="lg:col-span-2 p-6">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b mb-6">
              <div className="flex items-center gap-3">
                <Avatar fallback={selectedConversation.userName} />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedConversation.userName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Bot className="h-3 w-3" />
                    <span>{selectedConversation.agentName}</span>
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  selectedConversation.status === "active"
                    ? "success"
                    : selectedConversation.status === "waiting"
                    ? "warning"
                    : "secondary"
                }
                className="capitalize"
              >
                {selectedConversation.status}
              </Badge>
            </div>

            {/* Messages */}
            <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
              {selectedConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.sender === "agent" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      message.sender === "agent"
                        ? "bg-primary-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {message.sender === "agent" ? (
                      <Bot className="h-4 w-4 text-primary-600" />
                    ) : (
                      <User className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  <div
                    className={`flex-1 max-w-[70%] ${
                      message.sender === "user" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block rounded-lg px-4 py-2 ${
                        message.sender === "agent"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-primary-600 text-white"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{message.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="flex gap-3 pt-4 border-t">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Conversation Selected
            </h3>
            <p className="text-sm text-gray-500">
              Select a conversation from the list to view messages
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
