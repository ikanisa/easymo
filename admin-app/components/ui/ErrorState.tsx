import { ErrorState as UiErrorState, type ErrorStateProps as UiErrorStateProps } from "@easymo/ui/components/feedback";

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

interface ErrorStateProps extends UiErrorStateProps {}

export function ErrorState(props: ErrorStateProps) {
  if (uiKitEnabled) {
    return <UiErrorState {...props} />;
  }

  const { title, description, action, className } = props;

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-dashed border-[color:var(--color-danger)]/60 bg-[color:var(--color-surface)]/50 px-6 py-8 text-center${className ? ` ${className}` : ""}`}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">{title ?? "Something went wrong"}</h3>
        {description ? (
          <p className="text-sm text-[color:var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
