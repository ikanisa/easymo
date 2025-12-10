import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Chip, type ChipProps } from "./Chip";
import { Glass } from "./Glass";
import { mobileTheme } from "./theme/tokens";

export interface GroupCardAction extends Omit<ChipProps, "style"> {
  id: string;
  style?: StyleProp<ViewStyle>;
}

export interface GroupCardProps {
  name: string;
  code: string;
  memberCount: number;
  saccoName?: string;
  createdAt?: string | Date;
  contributionCycle?: string;
  totalSavings?: string;
  tags?: string[];
  actions?: GroupCardAction[];
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GroupCard({
  name,
  code,
  memberCount,
  saccoName,
  createdAt,
  contributionCycle,
  totalSavings,
  tags = [],
  actions = [],
  onPress,
  disabled = false,
  style,
}: GroupCardProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.97, {
      damping: 12,
      stiffness: 300,
      mass: 0.4,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 14,
      stiffness: 260,
      mass: 0.4,
    });
  };

  const formattedCreatedAt = createdAt
    ? new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric",
      }).format(new Date(createdAt))
    : undefined;

  const membersLabel = `${memberCount.toLocaleString()} member${memberCount === 1 ? "" : "s"}`;

  return (
    <AnimatedPressable
      accessibilityRole={onPress ? "button" : "summary"}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.touchable, animatedStyle, disabled ? styles.disabled : undefined, style]}
    >
      <Glass
        contentStyle={[styles.content, isWide ? styles.contentWide : undefined]}
        style={styles.glass}
        overlay={
          totalSavings ? (
            <MetaPill label="Total Savings" value={totalSavings} variant="accent" />
          ) : undefined
        }
      >
        <View style={[styles.header, isWide ? styles.headerWide : undefined]}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {`Code ${code.toUpperCase()} • ${membersLabel}`}
            </Text>
          </View>
          {actions.length ? (
            <View style={[styles.actions, isWide ? styles.actionsWide : undefined]}>
              {actions.map(({ id, style: actionStyle, ...chip }) => (
                <Chip key={id} {...chip} style={[styles.actionChip, actionStyle]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.metaRow, isWide ? styles.metaRowWide : undefined]}>
          <MetaPill label="SACCO" value={saccoName ?? "Independent"} />
          <MetaPill label="Cycle" value={contributionCycle ?? "Flexible"} />
          {formattedCreatedAt ? <MetaPill label="Started" value={formattedCreatedAt} /> : null}
        </View>

        {tags.length ? (
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <Chip key={tag} label={tag} disabled variant="outline" />
            ))}
          </View>
        ) : null}
      </Glass>
    </AnimatedPressable>
  );
}

interface MetaPillProps extends PropsWithChildren {
  label: string;
  value: string;
  variant?: "default" | "accent";
}

function MetaPill({ label, value, variant = "default" }: MetaPillProps) {
  return (
    <View style={[styles.metaPill, variant === "accent" ? styles.metaPillAccent : undefined]}>
      <Text style={[styles.metaLabel, variant === "accent" ? styles.metaLabelAccent : undefined]}>
        {label}
      </Text>
      <Text
        style={[styles.metaValue, variant === "accent" ? styles.metaValueAccent : undefined]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: "100%",
  },
  disabled: {
    opacity: 0.6,
  },
  glass: {
    flex: 1,
  },
  content: {
    gap: mobileTheme.spacing.xl,
  },
  contentWide: {
    gap: mobileTheme.spacing.xxl,
  },
  header: {
    gap: mobileTheme.spacing.md,
  },
  headerWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileTheme.spacing.xxl,
  },
  titleBlock: {
    flex: 1,
    gap: mobileTheme.spacing.xs,
  },
  title: {
    ...mobileTheme.typography.headingLg,
    color: mobileTheme.colors.textPrimary,
  },
  subtitle: {
    ...mobileTheme.typography.body,
    color: mobileTheme.colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTheme.spacing.sm,
  },
  actionsWide: {
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  actionChip: {
    minWidth: 96,
  },
  metaRow: {
    flexDirection: "column",
    gap: mobileTheme.spacing.sm,
  },
  metaRowWide: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: mobileTheme.spacing.sm,
    columnGap: mobileTheme.spacing.lg,
  },
  metaPill: {
    paddingVertical: mobileTheme.spacing.sm,
    paddingHorizontal: mobileTheme.spacing.lg,
    borderRadius: mobileTheme.radii.lg,
    backgroundColor: mobileTheme.colors.chipSurface,
    borderWidth: mobileTheme.border.width,
    borderColor: mobileTheme.colors.border,
    minWidth: 140,
  },
  metaPillAccent: {
    backgroundColor: mobileTheme.colors.accentBlue,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  metaLabel: {
    ...mobileTheme.typography.caption,
    textTransform: "uppercase",
    color: mobileTheme.colors.textMuted,
    marginBottom: mobileTheme.spacing.xs,
  },
  metaLabelAccent: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  metaValue: {
    ...mobileTheme.typography.body,
    color: mobileTheme.colors.textPrimary,
  },
  metaValueAccent: {
    color: "white",
    fontWeight: "600",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTheme.spacing.sm,
  },
});
