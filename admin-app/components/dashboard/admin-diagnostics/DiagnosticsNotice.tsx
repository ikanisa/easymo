import clsx from "clsx";

type DiagnosticsNoticeProps = {
  messages: readonly string[] | null | undefined;
  className?: string;
  dense?: boolean;
};

export function DiagnosticsNotice({
  messages,
  className,
  dense,
}: DiagnosticsNoticeProps) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        "rounded-md border border-dashed border-border bg-muted/40 text-xs text-muted-foreground",
        dense ? "p-2" : "p-3",
        className,
      )}
    >
      {messages.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  );
}
