import type { Metadata } from "next";
import { ChatCompletionsPlayground } from "@/components/ai/ChatCompletionsPlayground";

export const metadata: Metadata = {
  title: "Chat Completions Playground",
  description:
    "Test OpenAI Chat Completions flows via the Easymo proxy before rolling out automations to production.",
};

export default function ChatCompletionsPage() {
  return <ChatCompletionsPlayground />;
}

