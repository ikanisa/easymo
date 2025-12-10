import type { PropsWithChildren, ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { mobileTheme, rwandaFlagGradient } from "./theme/tokens";

export interface GradientHeaderProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  kicker?: string;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export function GradientHeader({
  title,
  subtitle,
  kicker,
  actions,
  children,
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
}: GradientHeaderProps) {
  return (
    <LinearGradient
      colors={[...rwandaFlagGradient]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.container, style]}
    >
      <View style={[styles.headerRow, contentStyle]}>
        <View style={styles.textColumn}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={[styles.title, titleStyle]} numberOfLines={2} adjustsFontSizeToFit>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, subtitleStyle]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: mobileTheme.radii.xl,
    paddingHorizontal: mobileTheme.spacing.xxxl,
    paddingVertical: mobileTheme.spacing.xxl,
    gap: mobileTheme.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileTheme.spacing.xl,
  },
  textColumn: {
    flex: 1,
    gap: mobileTheme.spacing.sm,
  },
  actions: {
    alignSelf: "flex-start",
    paddingTop: mobileTheme.spacing.xs,
  },
  children: {
    paddingTop: mobileTheme.spacing.sm,
  },
  kicker: {
    ...mobileTheme.typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: mobileTheme.colors.accentNeutral,
  },
  title: {
    ...mobileTheme.typography.headingLg,
    color: "white",
  },
  subtitle: {
    ...mobileTheme.typography.body,
    color: "rgba(255, 255, 255, 0.82)",
  },
});
