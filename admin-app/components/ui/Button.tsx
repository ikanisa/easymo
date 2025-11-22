"use client";

import {
  Button as UiButton,
  type ButtonProps as UiButtonProps,
} from "@easymo/ui/components/Button";
import { forwardRef } from "react";

import { useConnectivity } from "@/components/providers/ConnectivityProvider";
import { Button as LegacyButton, type ButtonProps as LegacyButtonProps,buttonVariants } from "@/components/ui/shadcn/button";

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

type FeatureButtonProps = LegacyButtonProps & Partial<UiButtonProps>;

export const Button = forwardRef<HTMLButtonElement, FeatureButtonProps>(function FeatureFlaggedButton(
  { offlineBehavior = "block", disabled, loading, ...props },
  ref,
) {
  const { isOnline } = useConnectivity();
  const offlineBlocked = offlineBehavior === "block" && !isOnline;
  const computedDisabled = disabled ?? loading ?? offlineBlocked;

  if (uiKitEnabled) {
    return (
      <UiButton
        ref={ref}
        disabled={computedDisabled}
        data-offline-disabled={offlineBlocked ? "true" : undefined}
        offlineBehavior={offlineBehavior}
        loading={loading}
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
      loading={loading}
      {...props}
    />
  );
});

export type ButtonProps = FeatureButtonProps;
export { buttonVariants };
