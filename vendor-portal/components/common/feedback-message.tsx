"use client";

import type { ReactNode } from "react";
import { Button, EmptyState, ErrorState, SuccessState } from "@ibimina/ui";

import { Trans } from "@/components/common/trans";

export interface MessageDescriptor {
  i18nKey: string;
  fallback: string;
  values?: Record<string, string | number>;
}

export type FeedbackVariant = "empty" | "error" | "success";
export type FeedbackTone = "default" | "offline" | "quiet";

export interface FeedbackAction {
  id?: string;
  label: MessageDescriptor;
  variant?: "primary" | "secondary" | "link";
  href?: string;
  onClick?: () => void;
}

export interface FeedbackMessageProps {
  variant: FeedbackVariant;
  title: MessageDescriptor;
  description?: MessageDescriptor;
  hint?: MessageDescriptor;
  tone?: FeedbackTone;
  actions?: FeedbackAction[];
  icon?: ReactNode;
  className?: string;
}

function renderCopy(descriptor: MessageDescriptor, className?: string) {
  return (
    <Trans
      i18nKey={descriptor.i18nKey}
      fallback={descriptor.fallback}
      values={descriptor.values}
      className={className}
    />
  );
}

function renderActions(actions: FeedbackAction[] | undefined) {
  if (!actions || actions.length === 0) return undefined;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {actions.map((action, index) => {
        const key = action.id ?? `${action.label.i18nKey}-${index}`;
        const variant = resolveButtonVariant(action.variant);
        const label = renderCopy(action.label);

        if (action.href) {
          return (
            <Button key={key} asChild variant={variant}>
              <a href={action.href}>{label}</a>
            </Button>
          );
        }

        return (
          <Button key={key} type="button" variant={variant} onClick={action.onClick}>
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function resolveButtonVariant(variant: FeedbackAction["variant"]) {
  switch (variant) {
    case "secondary":
      return "outline";
    case "link":
      return "link";
    default:
      return "default";
  }
}

export function FeedbackMessage({
  variant,
  title,
  description,
  hint,
  tone = "default",
  actions,
  icon,
  className,
}: FeedbackMessageProps) {
  const actionSlot = renderActions(actions);
  const hintNode = hint ? renderCopy(hint) : undefined;

  if (variant === "error") {
    return (
      <ErrorState
        title={renderCopy(title)}
        description={description ? renderCopy(description) : undefined}
        action={actionSlot}
        offlineHint={hintNode}
        icon={icon}
        className={className}
      />
    );
  }

  if (variant === "success") {
    return (
      <SuccessState
        title={renderCopy(title)}
        description={description ? renderCopy(description) : undefined}
        action={actionSlot}
        eyebrow={hintNode}
        icon={icon}
        className={className}
      />
    );
  }

  return (
    <EmptyState
      title={renderCopy(title)}
      description={description ? renderCopy(description) : undefined}
      action={actionSlot}
      tone={tone}
      offlineHint={tone === "offline" ? hintNode : undefined}
      icon={icon}
      className={className}
    />
  );
}
