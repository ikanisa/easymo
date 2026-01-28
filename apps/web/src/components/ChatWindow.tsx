import { useEffect, useRef } from "react";
import clsx from "clsx";

export type ChatMessage = {
  id: string;
  role: "user" | "moltbot";
  text: string;
  tone?: "clarify" | "confirm";
};

type ChatWindowProps = {
  messages: ChatMessage[];
};

export function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [messages]);

  return (
    <div className="chat-window" aria-live="polite">
      <div className="chat-scroller">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx("message-bubble", {
              "message-user": message.role === "user",
              "message-bot": message.role === "moltbot",
              "message-clarify": message.tone === "clarify",
            })}
          >
            <p>{message.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
