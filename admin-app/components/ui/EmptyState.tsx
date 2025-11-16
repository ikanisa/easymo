import React from "react";
import { EmptyState as UiEmptyState, type EmptyStateProps as UiEmptyStateProps } from "@easymo/ui/components/feedback";

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

interface EmptyStateProps extends UiEmptyStateProps {}

export function EmptyState(props: EmptyStateProps) {
  if (uiKitEnabled) {
    return <UiEmptyState {...props} />;
  }

  const { title, description, action } = props;

  return (
    <div className="empty-state" role="status" aria-live="polite">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
