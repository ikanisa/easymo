"use client";

import { forwardRef } from "react";
import {
  Button as LegacyButton,
  buttonVariants as legacyVariants,
  type ButtonProps as LegacyButtonProps,
} from "@/components/ui/shadcn/button";
import { useConnectivity } from "@/components/providers/ConnectivityProvider";
import {
  Button as KitButton,
  buttonRecipe as kitVariants,
  type ButtonProps as KitButtonProps,
} from "@easymo/ui";
import { isUiKitEnabled } from "@/lib/ui-kit";

const uiKitEnabled = isUiKitEnabled();

export type ButtonProps = LegacyButtonProps;

export const buttonVariants = uiKitEnabled
  ? (kitVariants as typeof legacyVariants)
  : legacyVariants;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ offlineBehavior = "block", disabled, className, variant = "default", size = "default", ...props }, ref) => {
    if (!uiKitEnabled) {
      return (
        <LegacyButton
          ref={ref}
          offlineBehavior={offlineBehavior}
          disabled={disabled}
          className={className}
          variant={variant}
          size={size}
          {...props}
        />
      );
    }

    const { isOnline } = useConnectivity();
    const offlineBlocked = offlineBehavior === "block" && !isOnline;
    const computedDisabled = disabled ?? offlineBlocked;
    const kitVariantMap: Record<string, KitButtonProps["variant"]> = {
      default: "primary",
      outline: "secondary",
      ghost: "ghost",
      subtle: "secondary",
      danger: "destructive",
    };
    const kitSizeMap: Record<string, KitButtonProps["size"]> = {
      default: "md",
      sm: "sm",
      lg: "lg",
      icon: "icon",
    };
    const mappedVariant = kitVariantMap[variant] ?? "primary";
    const mappedSize = kitSizeMap[size] ?? "md";
    const tone = variant === "outline" ? "outline" : undefined;
    const kitProps = props as Omit<KitButtonProps, "variant" | "tone" | "size" | "className">;

    return (
      <KitButton
        ref={ref}
        disabled={computedDisabled}
        data-offline-disabled={offlineBlocked ? "true" : undefined}
        className={className}
        variant={mappedVariant}
        size={mappedSize}
        tone={tone}
        {...kitProps}
      />
    );
  },
);

Button.displayName = "Button";
