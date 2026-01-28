import clsx from "clsx";

export type QuickReply = {
  label: string;
  value: string;
  tone?: "intent" | "log";
};

type QuickRepliesProps = {
  replies: QuickReply[];
  onSelect: (value: string) => void;
  disabled?: boolean;
};

export function QuickReplies({ replies, onSelect, disabled = false }: QuickRepliesProps) {
  return (
    <div className="quick-replies" role="list">
      {replies.map((reply) => (
        <button
          key={reply.value}
          type="button"
          className={clsx("chip", { "chip-accent": reply.tone === "intent" })}
          onClick={() => onSelect(reply.value)}
          disabled={disabled}
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}
