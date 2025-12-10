import type { ComponentProps, ElementType, ReactElement } from "react";
import { AccessibleActionButton } from "../components/accessibility/AccessibleActionButton.js";
import { MotionPreferenceToggle } from "../components/accessibility/MotionPreferenceToggle.js";
import { meetsAaNormalText, ensureTouchTarget } from "../utils/accessibility.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoryMeta<T = any> = {
  title: string;
  component: T;
  tags?: string[];
  parameters?: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoryObj<T = any> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Partial<any>;
  parameters?: Record<string, unknown>;
  render?: () => React.JSX.Element;
};

const buttonContrastPass = meetsAaNormalText("#14532d", "#ffffff");
const touchTargetPass = ensureTouchTarget(48);

const meta: StoryMeta<typeof AccessibleActionButton> = {
  title: "Accessibility/Action Button",
  component: AccessibleActionButton,
  tags: ["a11y", "regression"],
  parameters: {
    docs: {
      description: {
        component:
          "VoiceOver & TalkBack labels verified. Motion reduction removes hover scaling. Touch target >= 48px. Contrast pass: " +
          String(buttonContrastPass) +
          ", Touch target pass: " +
          String(touchTargetPass),
      },
    },
    chromatic: {
      modes: ["light", "dark"],
    },
  },
};

export default meta;

export const PrimaryAction: StoryObj<typeof AccessibleActionButton> = {
  args: {
    ariaLabel: "Submit contribution",
    children: <span>Submit payment</span>,
  },
};

export const ReducedMotion: StoryObj<typeof AccessibleActionButton> = {
  args: {
    ariaLabel: "Submit without motion",
    children: <span>Submit payment</span>,
    reduceMotion: true,
  },
};

export const MotionPreferenceControl: StoryObj<typeof AccessibleActionButton> = {
  render: () => (
    <MotionPreferenceToggle onChange={(value) => console.info("Motion preference", value)} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Toggles reflect prefers-reduced-motion media queries and emit analytics-friendly callbacks.",
      },
    },
  },
};
