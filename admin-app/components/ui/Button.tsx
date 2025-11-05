"use client";

import { forwardRef } from "react";
import { Button as LegacyButton, buttonVariants, type ButtonProps as LegacyButtonProps } from "@/components/ui/shadcn/button";
import { Button as UiButton, type ButtonProps as UiButtonProps } from "@easymo/ui";
import { useConnectivity } from "@/components/providers/ConnectivityProvider";

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

type FeatureButtonProps = LegacyButtonProps & Partial<UiButtonProps>;

export const Button = forwardRef<HTMLButtonElement, FeatureButtonProps>(function FeatureFlaggedButton(
  { offlineBehavior = "block", disabled, ...props },
  ref,
) {
  const { isOnline } = useConnectivity();
  const offlineBlocked = offlineBehavior === "block" && !isOnline;
  const computedDisabled = disabled ?? offlineBlocked;

  if (uiKitEnabled) {
    return (
      <UiButton
        ref={ref}
        disabled={computedDisabled}
        data-offline-disabled={offlineBlocked ? "true" : undefined}
        offlineBehavior={offlineBehavior}
        {...props}
      />
    );
  }

  return (
    <LegacyButton
      ref={ref}
      disabled={computedDisabled}
      data-offline-disabled={offlineBlocked ? "true" : undefined}
      offlineBehavior={offlineBehavior}
      {...props}
    />
  );
});

export type ButtonProps = FeatureButtonProps;
export { buttonVariants };
