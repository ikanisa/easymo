import type { PropsWithChildren, ReactNode } from "react";
import { BlurView } from "expo-blur";
import type { BlurTint } from "expo-blur";
import type { StyleProp, ViewStyle } from "react-native";
import { View, StyleSheet } from "react-native";

import { mobileTheme } from "./theme/tokens";

export interface GlassProps extends PropsWithChildren {
  /** Optional content rendered above the inner padding (e.g. floating badges). */
  overlay?: ReactNode;
  /** Overrides the blur intensity if a different strength is required. */
  blurIntensity?: number;
  /** Overrides the tint used by the blur view. */
  tint?: BlurTint;
  /** Allows consumers to customise the outer glass surface styling. */
  style?: StyleProp<ViewStyle>;
  /** Additional style overrides for the padded inner container. */
  contentStyle?: StyleProp<ViewStyle>;
}

export function Glass({
  children,
  overlay,
  blurIntensity = mobileTheme.blur.intensity,
  tint = mobileTheme.blur.tint,
  style,
  contentStyle,
}: GlassProps) {
  return (
    <BlurView intensity={blurIntensity} tint={tint} style={[styles.glass, style]}>
      {overlay && (
        <View pointerEvents="none" style={styles.overlay}>
          {overlay}
        </View>
      )}
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: mobileTheme.radii.xl,
    borderWidth: mobileTheme.border.width,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surface,
    overflow: "hidden",
    ...mobileTheme.shadow.glass,
  },
  inner: {
    paddingVertical: mobileTheme.spacing.xxl,
    paddingHorizontal: mobileTheme.spacing.xxl,
    gap: mobileTheme.spacing.lg,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: mobileTheme.spacing.md,
  },
});
