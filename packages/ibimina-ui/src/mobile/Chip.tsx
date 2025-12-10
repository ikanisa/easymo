import type { ReactNode } from "react";
import type { GestureResponderEvent, StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileTheme } from "./theme/tokens";

export type ChipVariant = "primary" | "outline" | "ghost";

export interface ChipProps {
  label: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  variant?: ChipVariant;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function Chip({
  label,
  icon,
  trailingIcon,
  selected = false,
  disabled = false,
  variant = "ghost",
  onPress,
  style,
  labelStyle,
  testID,
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        selected ? styles.selected : undefined,
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
        style,
      ]}
      testID={testID}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            variantLabelStyles[variant],
            selected ? styles.labelSelected : undefined,
            labelStyle,
          ]}
        >
          {label}
        </Text>
        {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: mobileTheme.radii.lg,
    borderWidth: mobileTheme.border.width,
    borderColor: "transparent",
    paddingHorizontal: mobileTheme.spacing.lg,
    paddingVertical: mobileTheme.spacing.sm,
    backgroundColor: mobileTheme.colors.chipSurface,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileTheme.spacing.xs,
  },
  label: {
    ...mobileTheme.typography.body,
    color: mobileTheme.colors.textSecondary,
  },
  labelSelected: {
    color: mobileTheme.colors.accentBlue,
  },
  icon: {
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
  selected: {
    borderColor: mobileTheme.colors.accentBlue,
    backgroundColor: mobileTheme.colors.chipSurfaceActive,
  },
});

const variantStyles: Record<ChipVariant, ViewStyle> = {
  primary: {
    backgroundColor: mobileTheme.colors.accentBlue,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  outline: {
    borderColor: mobileTheme.colors.border,
    backgroundColor: "transparent",
  },
  ghost: {
    backgroundColor: mobileTheme.colors.chipSurface,
  },
};

const variantLabelStyles: Record<ChipVariant, TextStyle> = {
  primary: {
    color: "white",
    fontWeight: "600",
  },
  outline: {
    color: mobileTheme.colors.textSecondary,
  },
  ghost: {
    color: mobileTheme.colors.textSecondary,
  },
};
